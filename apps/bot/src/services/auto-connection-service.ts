import {
  Guild,
  PermissionFlagsBits,
  VoiceState,
} from 'discord.js';
import type {
  ResolvedAutoJoinSettings,
  VcSession,
} from '@sumirevox/shared';
import { getClient } from '../infrastructure/discord-client.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { getAutoJoinSettings, getGuildSettings } from './guild-settings-service.js';
import {
  destroyVcSession,
  getAllVcSessions,
  getVcSession,
  moveVcSession,
} from './vc-session-manager.js';
import { getAvailableBotInstanceIds } from './premium-service.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { REDIS_KEYS } from '@sumirevox/shared';
import {
  cancelDisconnectTimer,
  startDisconnectTimer,
} from './auto-disconnect-timer.js';
import type { AutoJoinCandidate } from './auto-channel-selector.js';
import {
  countHumanMembers,
  rankAutoJoinCandidates,
} from './auto-channel-selector.js';
import { allocateVoiceConnection } from './vc-allocation-service.js';

interface RuntimeAutoJoinCandidate extends AutoJoinCandidate {
  voiceChannel: NonNullable<ReturnType<typeof getVoiceChannel>>;
}

const guildLocks = new Map<string, Promise<void>>();

/**
 * 同一ギルドの自動接続・切り替えを直列化する。
 * voiceStateUpdate とタイマーのどちらが先に接続しても、後続処理でセッションを再確認できる。
 */
async function withGuildAutoConnectionLock<T>(
  guildId: string,
  task: () => Promise<T>,
): Promise<T> {
  const previous = guildLocks.get(guildId);
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  guildLocks.set(guildId, current);

  try {
    if (previous) await previous;
    return await task();
  } finally {
    release();
    if (guildLocks.get(guildId) === current) guildLocks.delete(guildId);
  }
}

/** 自動接続対象VCへの参加を検出して接続する。 */
export async function handleAutoJoinVoiceState(
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  if (!newState.channelId || oldState.channelId === newState.channelId) return;

  const guildId = newState.guild.id;
  try {
    await withGuildAutoConnectionLock(guildId, async () => {
      const settings = await getGuildSettings(guildId);
      const autoJoinSettings = getAutoJoinSettings(settings);
      if (!autoJoinSettings.autoJoin) return;

      const pair = autoJoinSettings.channelPairs.find(
        (candidate) => candidate.voiceChannelId === newState.channelId,
      );
      if (!pair) return;

      const voiceChannel = getVoiceChannel(newState.guild, pair.voiceChannelId);
      if (!voiceChannel) {
        logger.warn(
          { guildId, voiceChannelId: pair.voiceChannelId },
          'Auto-join skipped: voice channel not found or is not voice-based',
        );
        return;
      }

      if (!getTextChannel(newState.guild, pair.textChannelId)) {
        logger.warn(
          { guildId, textChannelId: pair.textChannelId },
          'Auto-join skipped: text channel not found or is not text-based',
        );
        return;
      }

      if (!hasVoicePermissions(newState.guild, voiceChannel)) {
        logger.warn(
          { guildId, channelId: voiceChannel.id },
          'Auto-join skipped: missing Connect or Speak permission',
        );
        return;
      }

      // 同一プロセスですでに対象VCを担当している場合は、既存セッションを変更しない。
      if (getVcSession(guildId)?.voiceChannelId === pair.voiceChannelId) return;

      const allocation = await allocateVoiceConnection({
        guildId,
        voiceChannelId: pair.voiceChannelId,
        textChannelId: pair.textChannelId,
        connectionMode: 'auto',
        existingOwnerBehavior: 'preserve',
      });

      if (allocation.status === 'capacity') {
        if (config.botInstanceId === 1) {
          await notifyAutoJoinCapacity(
            guildId,
            pair.voiceChannelId,
            pair.textChannelId,
            newState.guild,
          );
        }
        return;
      }
      if (allocation.status === 'failed') {
        logger.warn(
          { guildId, voiceChannelId: pair.voiceChannelId, message: allocation.message },
          'Auto-join allocation failed',
        );
        return;
      }

      // 既存VCの所有者がある場合は、手動セッションを自動扱いへ変更しない。
      if (allocation.status === 'already-connected') return;

      const currentSession = getVcSession(guildId);
      if (currentSession?.voiceChannelId !== pair.voiceChannelId) {
        // サブBotへ委譲した場合、接続セッションは担当Bot側に存在する。
        logger.info(
          {
            guildId,
            voiceChannelId: pair.voiceChannelId,
            textChannelId: pair.textChannelId,
            instanceId: allocation.instanceId,
          },
          'Auto-joined VC through allocated Bot',
        );
        return;
      }

      logger.info(
        { guildId, voiceChannelId: pair.voiceChannelId, textChannelId: pair.textChannelId },
        'Auto-joined VC',
      );

      await checkAutoDisconnect(guildId, newState.guild, pair.voiceChannelId);
    });
  } catch (error) {
    logger.error({ err: error, guildId }, 'Auto-join failed');
  }
}

/** 現在のVCが無人になったときに、接続モードに応じたタイマーを開始する。 */
export async function checkAutoDisconnect(
  guildId: string,
  guild: Guild,
  voiceChannelId: string,
): Promise<void> {
  try {
    const session = getVcSession(guildId);
    if (!session || session.voiceChannelId !== voiceChannelId) return;

    // 旧Redisセッションおよび /join 由来のセッションは自動切り替え対象外。
    if (session.connectionMode !== 'auto') {
      const voiceChannel = getVoiceChannel(guild, voiceChannelId);
      if (!voiceChannel) return;

      // 手動セッションは従来どおり無人化時に退出するが、別VCへの自動切り替えはしない。
      if (countHumanMembers(voiceChannel.members.values()) === 0) {
        startDisconnectTimer(guildId, handleManualDisconnectTimerExpired);
      } else {
        cancelDisconnectTimer(guildId);
      }
      return;
    }

    const voiceChannel = getVoiceChannel(guild, voiceChannelId);
    if (!voiceChannel) {
      logger.warn(
        { guildId, voiceChannelId },
        'Auto-disconnect check skipped: current voice channel not found',
      );
      return;
    }

    const humanMemberCount = countHumanMembers(voiceChannel.members.values());
    if (humanMemberCount === 0) {
      startDisconnectTimer(guildId, handleAutoDisconnectTimerExpired);
    } else {
      cancelDisconnectTimer(guildId);
    }
  } catch (error) {
    logger.error({ err: error, guildId }, 'Error in auto-disconnect check');
  }
}

async function handleManualDisconnectTimerExpired(guildId: string): Promise<void> {
  const session = getVcSession(guildId);
  if (!session || session.connectionMode === 'auto') return;

  const guild = getClient().guilds.cache.get(guildId);
  if (!guild) {
    await destroyVcSession(guildId);
    return;
  }

  const voiceChannel = getVoiceChannel(guild, session.voiceChannelId);
  if (!voiceChannel || countHumanMembers(voiceChannel.members.values()) === 0) {
    await destroyVcSession(guildId);
    return;
  }

  logger.info({ guildId }, 'Manual disconnect cancelled: a human member returned');
}

/** 無人化タイマー満了後にVCを再走査し、必要なら最多人数のVCへ移動する。 */
export async function handleAutoDisconnectTimerExpired(guildId: string): Promise<void> {
  try {
    await withGuildAutoConnectionLock(guildId, async () => {
      const session = getVcSession(guildId);
      if (!session || session.connectionMode !== 'auto') return;

      const guild = getClient().guilds.cache.get(guildId);
      if (!guild) {
        logger.warn({ guildId }, 'Auto-disconnect: guild not found, destroying session');
        await destroyVcSession(guildId);
        return;
      }

      const currentVoiceChannel = getVoiceChannel(guild, session.voiceChannelId);
      if (!currentVoiceChannel) {
        logger.warn(
          { guildId, voiceChannelId: session.voiceChannelId },
          'Auto-disconnect: current voice channel not found, destroying session',
        );
        await destroyAutoSessionIfCurrent(guildId, session);
        return;
      }

      // タイマー満了と入室イベントが競合しても、満了直前の人数を必ず再確認する。
      if (countHumanMembers(currentVoiceChannel.members.values()) > 0) {
        logger.info({ guildId }, 'Auto-disconnect cancelled: a human member returned');
        return;
      }

      const settings = await getGuildSettings(guildId);
      const instanceSettings = getAutoJoinSettings(settings);
      const currentSession = getVcSession(guildId);
      if (currentSession !== session || currentSession.connectionMode !== 'auto') return;
      if (!instanceSettings.autoJoin) {
        await destroyVcSession(guildId);
        return;
      }

      if (!(await getAvailableBotInstanceIds(guildId)).includes(config.botInstanceId)) {
        logger.info(
          { guildId, instanceId: config.botInstanceId },
          'Auto-switch skipped: insufficient boosts for this instance',
        );
        await destroyAutoSessionIfCurrent(guildId, session);
        return;
      }

      const candidates = collectAutoJoinCandidates(
        guild,
        instanceSettings,
        session.voiceChannelId,
      );
      const rankedCandidates = rankAutoJoinCandidates(candidates);
      logger.debug(
        {
          guildId,
          candidates: rankedCandidates.map((candidate) => ({
            voiceChannelId: candidate.pair.voiceChannelId,
            humanMemberCount: candidate.humanMemberCount,
          })),
        },
        'Auto-switch candidates ranked',
      );

      for (const candidate of rankedCandidates) {
        if (candidate.humanMemberCount === 0) {
          logger.debug(
            { guildId, voiceChannelId: candidate.pair.voiceChannelId },
            'Auto-switch candidate skipped: no human members',
          );
          continue;
        }

        if (!hasVoicePermissions(guild, candidate.voiceChannel)) {
          logger.warn(
            { guildId, voiceChannelId: candidate.pair.voiceChannelId },
            'Auto-switch candidate skipped: missing Connect or Speak permission',
          );
          continue;
        }

        try {
          const latestSession = getVcSession(guildId);
          if (latestSession !== session || latestSession.connectionMode !== 'auto') return;

          await moveVcSession(
            guildId,
            candidate.pair.voiceChannelId,
            candidate.pair.textChannelId,
            guild.voiceAdapterCreator,
            'auto',
          );
          await checkAutoDisconnect(
            guildId,
            guild,
            candidate.pair.voiceChannelId,
          );
          logger.info(
            {
              guildId,
              voiceChannelId: candidate.pair.voiceChannelId,
              textChannelId: candidate.pair.textChannelId,
              humanMemberCount: candidate.humanMemberCount,
            },
            'Auto-switched VC session',
          );
          return;
        } catch (error) {
          logger.error(
            { err: error, guildId, voiceChannelId: candidate.pair.voiceChannelId },
            'Auto-switch candidate failed, trying the next candidate',
          );
          const latestSession = getVcSession(guildId);
          if (latestSession !== session || latestSession.connectionMode !== 'auto') return;
        }
      }

      await destroyAutoSessionIfCurrent(guildId, session);
      logger.info({ guildId }, 'Auto-disconnected: no occupied candidate VC found');
    });
  } catch (error) {
    logger.error({ err: error, guildId }, 'Failed to handle auto-disconnect timer');
  }
}

/** Redisから復旧した自動セッションのタイマーを再構築する。 */
export async function scheduleDisconnectTimersForRestoredSessions(): Promise<void> {
  const client = getClient();
  for (const session of getAllVcSessions().values()) {
    const guild = client.guilds.cache.get(session.guildId);
    if (guild) {
      await checkAutoDisconnect(guild.id, guild, session.voiceChannelId);
    }
  }
}

/** 設定またはBoost枠の変更後、無効になった自動接続だけを安全に退出させる。 */
export async function reconcileAutoConnectionSession(guildId: string): Promise<void> {
  const session = getVcSession(guildId);
  if (!session || session.connectionMode !== 'auto') return;

  const [settings, availableInstanceIds] = await Promise.all([
    getGuildSettings(guildId),
    getAvailableBotInstanceIds(guildId),
  ]);
  const autoJoinSettings = getAutoJoinSettings(settings);
  const isConfigured = autoJoinSettings.autoJoin && autoJoinSettings.channelPairs.some(
    (pair) => pair.voiceChannelId === session.voiceChannelId,
  );
  if (!isConfigured || !availableInstanceIds.includes(config.botInstanceId)) {
    await destroyAutoSessionIfCurrent(guildId, session);
  }
}

function collectAutoJoinCandidates(
  guild: Guild,
  instanceSettings: ResolvedAutoJoinSettings,
  currentVoiceChannelId: string,
): RuntimeAutoJoinCandidate[] {
  const candidates: RuntimeAutoJoinCandidate[] = [];

  for (const [order, pair] of instanceSettings.channelPairs.entries()) {
    if (pair.voiceChannelId === currentVoiceChannelId) continue;

    const voiceChannel = getVoiceChannel(guild, pair.voiceChannelId);
    if (!voiceChannel) {
      logger.warn(
        { guildId: guild.id, voiceChannelId: pair.voiceChannelId },
        'Auto-switch candidate skipped: voice channel not found or is not voice-based',
      );
      continue;
    }

    if (!getTextChannel(guild, pair.textChannelId)) {
      logger.warn(
        { guildId: guild.id, textChannelId: pair.textChannelId },
        'Auto-switch candidate skipped: text channel not found or is not text-based',
      );
      continue;
    }

    candidates.push({
      pair,
      order,
      humanMemberCount: countHumanMembers(voiceChannel.members.values()),
      voiceChannel,
    });
  }

  return candidates;
}

function getVoiceChannel(guild: Guild, channelId: string) {
  const channel = guild.channels.cache.get(channelId);
  return channel?.isVoiceBased() ? channel : undefined;
}

function getTextChannel(guild: Guild, channelId: string) {
  const channel = guild.channels.cache.get(channelId);
  return channel?.isTextBased() ? channel : undefined;
}

function hasVoicePermissions(
  guild: Guild,
  voiceChannel: NonNullable<ReturnType<typeof getVoiceChannel>>,
): boolean {
  const me = guild.members.me;
  if (!me) return false;

  try {
    const permissions = voiceChannel.permissionsFor(me);
    return Boolean(
      permissions?.has(PermissionFlagsBits.Connect) &&
        permissions.has(PermissionFlagsBits.Speak),
    );
  } catch (error) {
    logger.warn(
      { err: error, guildId: guild.id, voiceChannelId: voiceChannel.id },
      'Failed to check voice channel permissions',
    );
    return false;
  }
}

async function destroyAutoSessionIfCurrent(
  guildId: string,
  expectedSession: VcSession,
): Promise<void> {
  const currentSession = getVcSession(guildId);
  if (currentSession === expectedSession && currentSession.connectionMode === 'auto') {
    await destroyVcSession(guildId);
  }
}

async function notifyAutoJoinCapacity(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  guild: Guild,
): Promise<void> {
  const noticeKey = REDIS_KEYS.AUTO_JOIN_CAPACITY_NOTIFICATION(guildId, voiceChannelId);
  const acquired = await getRedisClient().set(noticeKey, '1', 'EX', 30, 'NX');
  if (acquired !== 'OK') return;

  const textChannel = getTextChannel(guild, textChannelId);
  if (!textChannel) {
    logger.warn(
      { guildId, textChannelId },
      'Auto-join capacity notification skipped: text channel not found',
    );
    return;
  }

  try {
    await textChannel.send({
      content: '利用可能なBotがすべて別のVCで使用中のため、自動接続できません。',
    });
  } catch (error) {
    logger.warn(
      { err: error, guildId, textChannelId },
      'Failed to send auto-join capacity notification',
    );
  }
}
