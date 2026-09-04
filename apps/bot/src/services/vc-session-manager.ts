import { VcSession, VcSessionConnectionMode } from '@sumirevox/shared';
import {
  joinVoiceChannel,
  VoiceConnection,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
} from '@discordjs/voice';
import type { DiscordGatewayAdapterCreator } from '@discordjs/voice';
import {
  saveVcSessionToRedis,
  removeVcSessionFromRedis,
  getAllVcSessionsForBotInstance,
} from '../infrastructure/vc-session-store.js';
import { getClient } from '../infrastructure/discord-client.js';
import { logger } from '../infrastructure/logger.js';
import { config } from '../infrastructure/config.js';
import { deleteGuildQueue } from './speech-queue.js';
import { initTrieSlot, destroyTrieSlot } from './text-pipeline/index.js';
import { cancelDisconnectTimer } from './auto-disconnect-timer.js';
import {
  claimVcOwnership,
  getVcOwnershipRecoveryDelayMs,
  moveVcOwnership,
  releaseVcOwnership,
  renewVcOwnership,
  rollbackVcOwnershipMove,
} from './vc-ownership-service.js';

const sessions = new Map<string, VcSession>();
const connections = new Map<string, VoiceConnection>();
// Redis復元情報を保持して停止した接続から遅れて届くイベントを通常の退出処理へ流さない。
const preservedSessionConnections = new WeakSet<VoiceConnection>();
// `/leave` と自動切断による明示的な破棄だけがRedis復元情報を削除する。
const destructiveSessionConnections = new WeakSet<VoiceConnection>();
const pendingCreates = new Map<string, Promise<VcSession>>();
let ownershipRenewalTimer: ReturnType<typeof setInterval> | null = null;
const recoveryTimers = new Map<string, ReturnType<typeof setTimeout>>();
const recoveryAttempts = new Map<string, number>();
const RECOVERY_BACKOFF_BASE_MS = 5_000;
const RECOVERY_BACKOFF_MAX_MS = 60_000;

export async function createVcSession(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  adapterCreator: DiscordGatewayAdapterCreator,
  connectionMode: VcSessionConnectionMode = 'manual',
): Promise<VcSession> {
  const existing = sessions.get(guildId);
  if (existing) return existing;

  const pending = pendingCreates.get(guildId);
  if (pending) return pending;

  const creation = createVcSessionInternal(
    guildId,
    voiceChannelId,
    textChannelId,
    adapterCreator,
    connectionMode,
  );
  pendingCreates.set(guildId, creation);

  try {
    return await creation;
  } finally {
    if (pendingCreates.get(guildId) === creation) {
      pendingCreates.delete(guildId);
    }
  }
}

async function createVcSessionInternal(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  adapterCreator: DiscordGatewayAdapterCreator,
  connectionMode: VcSessionConnectionMode,
): Promise<VcSession> {
  const client = getClient();
  const shardId = client.shard?.ids[0] ?? 0;

  const ownership = await claimVcOwnership(guildId, voiceChannelId, config.botInstanceId);
  if (!ownership) throw new Error('Voice channel or bot instance is already owned');

  const session: VcSession = {
    guildId,
    voiceChannelId,
    textChannelId,
    shardId,
    botInstanceId: config.botInstanceId,
    claimId: ownership.claimId,
    connectionMode,
  };

  const connection = joinVoiceChannel({
    channelId: voiceChannelId,
    guildId,
    adapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  setupConnectionListeners(connection, guildId);

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (error) {
    connection.destroy();
    await releaseVcOwnership(guildId, voiceChannelId, ownership);
    throw error;
  }

  initTrieSlot(guildId);
  sessions.set(guildId, session);
  connections.set(guildId, connection);
  await saveVcSessionToRedis(session);

  logger.info({ guildId, voiceChannelId, textChannelId }, 'VC session created');
  return session;
}

export async function destroyVcSession(guildId: string): Promise<void> {
  cancelVcSessionRecovery(guildId);
  recoveryAttempts.delete(guildId);
  cancelDisconnectTimer(guildId);
  deleteGuildQueue(guildId);

  const session = sessions.get(guildId);
  const connection = connections.get(guildId) ?? getVoiceConnection(guildId);
  if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
    destructiveSessionConnections.add(connection);
    connection.destroy();
  }

  destroyTrieSlot(guildId);
  sessions.delete(guildId);
  connections.delete(guildId);
  await removeVcSessionFromRedis(guildId, config.botInstanceId);
  if (session?.claimId) {
    await releaseVcOwnership(guildId, session.voiceChannelId, {
      instanceId: session.botInstanceId,
      claimId: session.claimId,
    });
  }

  logger.info({ guildId }, 'VC session destroyed');
}

export function getVcSession(guildId: string): VcSession | undefined {
  return sessions.get(guildId);
}

export function getConnection(guildId: string): VoiceConnection | undefined {
  return connections.get(guildId);
}

export async function updateTextChannel(
  guildId: string,
  textChannelId: string,
  connectionMode: VcSessionConnectionMode = 'manual',
): Promise<void> {
  const session = sessions.get(guildId);
  if (!session) return;

  cancelDisconnectTimer(guildId);
  const updated: VcSession = { ...session, textChannelId, connectionMode };
  sessions.set(guildId, updated);
  await saveVcSessionToRedis(updated);

  logger.info({ guildId, textChannelId }, 'Text channel updated');
}

/**
 * 既存のVC接続を別チャンネルへ移動し、VC/TCペアを同時に更新する。
 * @discordjs/voice の既存接続を利用するため、セッションを一度破棄しない。
 */
export async function moveVcSession(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  adapterCreator: DiscordGatewayAdapterCreator,
  connectionMode: VcSessionConnectionMode = 'auto',
): Promise<VcSession> {
  const session = sessions.get(guildId);
  const currentConnection = connections.get(guildId) ?? getVoiceConnection(guildId);
  if (!session || !currentConnection) {
    throw new Error('VC session is not connected');
  }
  if (connectionMode === 'auto' && session.connectionMode !== 'auto') {
    throw new Error('VC session is not an auto connection');
  }

  cancelDisconnectTimer(guildId);

  if (!session.claimId) throw new Error('VC session has no ownership lease');
  const ownership = await moveVcOwnership(guildId, session.voiceChannelId, voiceChannelId, {
    instanceId: session.botInstanceId,
    claimId: session.claimId,
  });
  if (!ownership) throw new Error('Target voice channel or bot instance is already owned');
  const connection = joinVoiceChannel({
    channelId: voiceChannelId,
    guildId,
    adapterCreator,
    selfDeaf: true,
    selfMute: false,
  });

  if (connections.get(guildId) !== connection) {
    setupConnectionListeners(connection, guildId);
  }

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  } catch (error) {
    logger.error(
      { err: error, guildId, voiceChannelId },
      'Failed to move VC session',
    );
    await rollbackVcOwnershipMove(guildId, session.voiceChannelId, voiceChannelId, {
      instanceId: session.botInstanceId,
      claimId: session.claimId,
    }, ownership);
    throw error;
  }

  // /leave や別の接続処理が完了していた場合、古い移動処理でセッションを復活させない。
  if (sessions.get(guildId) !== session) {
    if (
      connection !== currentConnection &&
      connection.state.status !== VoiceConnectionStatus.Destroyed
    ) {
      connection.destroy();
    }
    await releaseVcOwnership(guildId, voiceChannelId, ownership);
    throw new Error('VC session changed while moving');
  }

  const updated: VcSession = {
    ...session,
    voiceChannelId,
    textChannelId,
    connectionMode,
    claimId: ownership.claimId,
  };
  // 切替前のTCで待機していた音声を、切替先VCで再生しない。
  deleteGuildQueue(guildId);
  sessions.set(guildId, updated);
  connections.set(guildId, connection);
  await saveVcSessionToRedis(updated);
  await releaseVcOwnership(guildId, session.voiceChannelId, {
    instanceId: session.botInstanceId,
    claimId: session.claimId,
  });

  logger.info({ guildId, voiceChannelId, textChannelId }, 'VC session moved');
  return updated;
}

export function getAllVcSessions(): Map<string, VcSession> {
  return sessions;
}

/**
 * 再起動時にVCセッションのローカル状態だけを停止する。
 * Redisの復元情報は残し、次回起動時に再接続できるようownership leaseだけ解放する。
 */
export async function destroyVcSessionForRestart(guildId: string): Promise<void> {
  await stopVcSessionWhilePreservingRedis(guildId);
  logger.info({ guildId }, 'VC session stopped for restart');
}

async function stopVcSessionForRecovery(guildId: string): Promise<void> {
  const session = await stopVcSessionWhilePreservingRedis(guildId);
  if (!session) return;

  const delay = nextRecoveryBackoffMs(guildId);
  logger.warn({ guildId, voiceChannelId: session.voiceChannelId, delay }, 'VC session stopped; recovery scheduled');
  scheduleVcSessionRecovery(session, delay);
}

async function stopVcSessionWhilePreservingRedis(guildId: string): Promise<VcSession | undefined> {
  cancelVcSessionRecovery(guildId);
  recoveryAttempts.delete(guildId);
  cancelDisconnectTimer(guildId);
  deleteGuildQueue(guildId);

  const session = sessions.get(guildId);
  const connection = connections.get(guildId) ?? getVoiceConnection(guildId);

  // Destroyedイベントが同期的に発火してもRedisセッションを削除しないよう、
  // 接続破棄より先にローカル状態を外す。
  if (connection) preservedSessionConnections.add(connection);
  destroyTrieSlot(guildId);
  sessions.delete(guildId);
  connections.delete(guildId);

  try {
    if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
  } catch (error) {
    logger.warn({ err: error, guildId }, 'Failed to destroy VC connection during restart');
  }

  if (session?.claimId) {
    await releaseVcOwnership(guildId, session.voiceChannelId, {
      instanceId: session.botInstanceId,
      claimId: session.claimId,
    });
  }

  return session;
}

/** 再起動時に全VCセッションを停止する。Redisの復元情報は削除しない。 */
export async function destroyAllVcSessionsForRestart(): Promise<void> {
  cancelAllVcSessionRecovery();
  const guildIds = Array.from(sessions.keys());
  for (const guildId of guildIds) {
    await destroyVcSessionForRestart(guildId);
  }
  logger.info({ count: guildIds.length }, 'All VC sessions stopped for restart');
}

export async function restoreVcSessions(): Promise<void> {
  const client = getClient();
  const shardId = client.shard?.ids[0] ?? 0;
  const savedSessions = await getAllVcSessionsForBotInstance(config.botInstanceId);

  if (savedSessions.length === 0) {
    logger.info({ shardId }, 'No VC sessions to restore');
    return;
  }

  logger.info({ shardId, count: savedSessions.length }, 'Restoring VC sessions...');

  for (const session of savedSessions) {
    // 現在のシャードが所有するギルドだけが接続する。保存時のshardIdは再シャーディングで変わり得る。
    if (!client.guilds.cache.get(session.guildId)) continue;
    await restoreVcSession(session);
  }
}

async function restoreVcSession(session: VcSession): Promise<void> {
  const client = getClient();
  const guild = client.guilds.cache.get(session.guildId);
  if (!guild) return;

  const voiceChannel = guild.channels.cache.get(session.voiceChannelId);
  if (!voiceChannel || !voiceChannel.isVoiceBased()) {
    logger.warn(
      { guildId: session.guildId, voiceChannelId: session.voiceChannelId },
      'Voice channel not found during session restore; retrying',
    );
    scheduleVcSessionRecovery(session, nextRecoveryBackoffMs(session.guildId));
    return;
  }

  try {
    await createVcSession(
      session.guildId,
      session.voiceChannelId,
      session.textChannelId,
      guild.voiceAdapterCreator,
      session.connectionMode === 'auto' ? 'auto' : 'manual',
    );
    recoveryAttempts.delete(session.guildId);
    cancelVcSessionRecovery(session.guildId);
    logger.info(
      { guildId: session.guildId, voiceChannelId: session.voiceChannelId },
      'VC session restored',
    );
  } catch (error) {
    const leaseDelay = await getVcOwnershipRecoveryDelayMs(
      session.guildId,
      session.voiceChannelId,
      config.botInstanceId,
    );
    const delay = leaseDelay || nextRecoveryBackoffMs(session.guildId);
    logger.warn(
      { err: error, guildId: session.guildId, voiceChannelId: session.voiceChannelId, delay },
      'VC session restore deferred',
    );
    scheduleVcSessionRecovery(session, delay);
  }
}

function scheduleVcSessionRecovery(session: VcSession, delay: number): void {
  if (recoveryTimers.has(session.guildId)) return;
  const timer = setTimeout(() => {
    recoveryTimers.delete(session.guildId);
    void restoreVcSession(session);
  }, delay);
  recoveryTimers.set(session.guildId, timer);
}

function nextRecoveryBackoffMs(guildId: string): number {
  const attempts = (recoveryAttempts.get(guildId) ?? 0) + 1;
  recoveryAttempts.set(guildId, attempts);
  return Math.min(RECOVERY_BACKOFF_BASE_MS * 2 ** (attempts - 1), RECOVERY_BACKOFF_MAX_MS);
}

export function cancelAllVcSessionRecovery(): void {
  for (const timer of recoveryTimers.values()) clearTimeout(timer);
  recoveryTimers.clear();
  recoveryAttempts.clear();
}

function cancelVcSessionRecovery(guildId: string): void {
  const timer = recoveryTimers.get(guildId);
  if (timer) clearTimeout(timer);
  recoveryTimers.delete(guildId);
}

export function startVcOwnershipRenewal(): void {
  if (ownershipRenewalTimer) return;
  ownershipRenewalTimer = setInterval(() => {
    void renewAllVcOwnership();
  }, 20_000);
}

export function stopVcOwnershipRenewal(): void {
  if (!ownershipRenewalTimer) return;
  clearInterval(ownershipRenewalTimer);
  ownershipRenewalTimer = null;
}

async function renewAllVcOwnership(): Promise<void> {
  for (const session of sessions.values()) {
    if (!session.claimId) continue;
    try {
      const renewed = await renewVcOwnership(session.guildId, session.voiceChannelId, {
        instanceId: session.botInstanceId,
        claimId: session.claimId,
      });
      if (sessions.get(session.guildId) !== session) continue;
      if (!renewed) {
        logger.warn({ guildId: session.guildId }, 'VC ownership lease lost; preserving session for recovery');
        await stopVcSessionForRecovery(session.guildId);
      }
    } catch (error) {
      if (sessions.get(session.guildId) !== session) continue;
      logger.error({ err: error, guildId: session.guildId }, 'Failed to renew VC ownership; preserving session for recovery');
      await stopVcSessionForRecovery(session.guildId);
    }
  }
}

function setupConnectionListeners(connection: VoiceConnection, guildId: string): void {
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    if (preservedSessionConnections.has(connection)) return;

    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      if (preservedSessionConnections.has(connection) || connections.get(guildId) !== connection) return;
      logger.warn({ guildId }, 'Voice connection failed to reconnect; preserving session for recovery');
      await stopVcSessionForRecovery(guildId);
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    if (preservedSessionConnections.has(connection)) return;
    if (destructiveSessionConnections.has(connection)) return;
    if (connections.get(guildId) !== connection) return;

    logger.warn({ guildId }, 'Voice connection destroyed unexpectedly; preserving session for recovery');
    void stopVcSessionForRecovery(guildId).catch((error) => {
      logger.error({ err: error, guildId }, 'Failed to preserve destroyed VC session for recovery');
    });
  });
}
