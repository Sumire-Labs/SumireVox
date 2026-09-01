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
  getAllVcSessionsForShard,
} from '../infrastructure/vc-session-store.js';
import { getClient } from '../infrastructure/discord-client.js';
import { logger } from '../infrastructure/logger.js';
import { config } from '../infrastructure/config.js';
import { deleteGuildQueue } from './speech-queue.js';
import { initTrieSlot, destroyTrieSlot } from './text-pipeline/index.js';
import { cancelDisconnectTimer } from './auto-disconnect-timer.js';

const sessions = new Map<string, VcSession>();
const connections = new Map<string, VoiceConnection>();
const pendingCreates = new Map<string, Promise<VcSession>>();

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

  const session: VcSession = {
    guildId,
    voiceChannelId,
    textChannelId,
    shardId,
    botInstanceId: config.botInstanceId,
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
  cancelDisconnectTimer(guildId);
  deleteGuildQueue(guildId);

  const connection = connections.get(guildId) ?? getVoiceConnection(guildId);
  if (connection && connection.state.status !== VoiceConnectionStatus.Destroyed) {
    connection.destroy();
  }

  destroyTrieSlot(guildId);
  sessions.delete(guildId);
  connections.delete(guildId);
  await removeVcSessionFromRedis(guildId, config.botInstanceId);

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
    throw new Error('VC session changed while moving');
  }

  const updated: VcSession = {
    ...session,
    voiceChannelId,
    textChannelId,
    connectionMode,
  };
  // 切替前のTCで待機していた音声を、切替先VCで再生しない。
  deleteGuildQueue(guildId);
  sessions.set(guildId, updated);
  connections.set(guildId, connection);
  await saveVcSessionToRedis(updated);

  logger.info({ guildId, voiceChannelId, textChannelId }, 'VC session moved');
  return updated;
}

export function getAllVcSessions(): Map<string, VcSession> {
  return sessions;
}

export async function destroyAllVcSessions(): Promise<void> {
  const guildIds = Array.from(sessions.keys());
  for (const guildId of guildIds) {
    await destroyVcSession(guildId);
  }
  logger.info({ count: guildIds.length }, 'All VC sessions destroyed');
}

export async function restoreVcSessions(): Promise<void> {
  const client = getClient();
  const shardId = client.shard?.ids[0] ?? 0;
  const savedSessions = await getAllVcSessionsForShard(shardId);

  if (savedSessions.length === 0) {
    logger.info({ shardId }, 'No VC sessions to restore');
    return;
  }

  logger.info({ shardId, count: savedSessions.length }, 'Restoring VC sessions...');

  for (const session of savedSessions) {
    try {
      const guild = client.guilds.cache.get(session.guildId);
      if (!guild) {
        logger.warn(
          { guildId: session.guildId },
          'Guild not found during session restore, removing session',
        );
        await removeVcSessionFromRedis(session.guildId, config.botInstanceId);
        continue;
      }

      const voiceChannel = guild.channels.cache.get(session.voiceChannelId);
      if (!voiceChannel || !voiceChannel.isVoiceBased()) {
        logger.warn(
          { guildId: session.guildId, voiceChannelId: session.voiceChannelId },
          'Voice channel not found during session restore, removing session',
        );
        await removeVcSessionFromRedis(session.guildId, config.botInstanceId);
        continue;
      }

      await createVcSession(
        session.guildId,
        session.voiceChannelId,
        session.textChannelId,
        guild.voiceAdapterCreator,
        session.connectionMode === 'auto' ? 'auto' : 'manual',
      );

      logger.info(
        { guildId: session.guildId, voiceChannelId: session.voiceChannelId },
        'VC session restored',
      );

    } catch (error) {
      logger.error({ err: error, guildId: session.guildId }, 'Failed to restore VC session');
      await removeVcSessionFromRedis(session.guildId, config.botInstanceId);
    }
  }
}

function setupConnectionListeners(connection: VoiceConnection, guildId: string): void {
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
    } catch {
      logger.warn({ guildId }, 'Voice connection failed to reconnect, destroying session');
      await destroyVcSession(guildId);
    }
  });

  connection.on(VoiceConnectionStatus.Destroyed, () => {
    if (connections.get(guildId) !== connection) return;

    logger.info({ guildId }, 'Voice connection destroyed');
    sessions.delete(guildId);
    connections.delete(guildId);
    removeVcSessionFromRedis(guildId, config.botInstanceId).catch(() => {});
  });
}
