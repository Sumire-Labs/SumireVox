import {
  Guild,
  PermissionFlagsBits,
  VoiceState,
} from 'discord.js';
import type {
  ResolvedBotInstanceSettings,
  VcSession,
} from '@sumirevox/shared';
import { getClient } from '../infrastructure/discord-client.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { getGuildSettings, getInstanceSettings } from './guild-settings-service.js';
import {
  createVcSession,
  destroyVcSession,
  getAllVcSessions,
  getVcSession,
  moveVcSession,
} from './vc-session-manager.js';
import { canInstanceConnect } from './premium-service.js';
import {
  cancelDisconnectTimer,
  startDisconnectTimer,
} from './auto-disconnect-timer.js';
import { enqueuePreSynthesized } from './speech-queue.js';
import { getPredefinedAudio } from './predefined-audio-cache.js';
import type { AutoJoinCandidate } from './auto-channel-selector.js';
import {
  countHumanMembers,
  rankAutoJoinCandidates,
} from './auto-channel-selector.js';

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
      if (getVcSession(guildId)) {
        logger.debug({ guildId }, 'Auto-join skipped: VC session was created concurrently');
        return;
      }

      const settings = await getGuildSettings(guildId);
      const instanceSettings = getInstanceSettings(settings, config.botInstanceId);
      if (!instanceSettings.autoJoin) return;

      const pair = instanceSettings.channelPairs.find(
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

      if (!(await canInstanceConnect(guildId, config.botInstanceId))) {
        logger.info(
          { guildId, instanceId: config.botInstanceId },
          'Auto-join skipped: insufficient boosts for this instance',
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

      const session = await createVcSession(
        guildId,
        pair.voiceChannelId,
        pair.textChannelId,
        newState.guild.voiceAdapterCreator,
        'auto',
      );

      // 手動 /join が先に接続した場合は、そのセッションを自動セッションとして扱わない。
      const currentSession = getVcSession(guildId);
      if (!currentSession || currentSession.voiceChannelId !== pair.voiceChannelId) return;

      logger.info(
        { guildId, voiceChannelId: pair.voiceChannelId, textChannelId: pair.textChannelId },
        'Auto-joined VC',
      );

      if (currentSession.connectionMode === 'auto' && settings.greetingOnJoin) {
        await enqueueConnectionGreeting(guildId, settings.defaultSpeakerId);
      }

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
      const instanceSettings = getInstanceSettings(settings, config.botInstanceId);
      const currentSession = getVcSession(guildId);
      if (currentSession !== session || currentSession.connectionMode !== 'auto') return;
      if (!instanceSettings.autoJoin) {
        await destroyVcSession(guildId);
        return;
      }

      if (!(await canInstanceConnect(guildId, config.botInstanceId))) {
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

function collectAutoJoinCandidates(
  guild: Guild,
  instanceSettings: ResolvedBotInstanceSettings,
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

async function enqueueConnectionGreeting(
  guildId: string,
  defaultSpeakerId: number | null,
): Promise<void> {
  const speakerId = defaultSpeakerId ?? config.defaultSpeakerId;
  const audio = await getPredefinedAudio('接続しました', speakerId, 1.0, 0.0);
  if (audio) enqueuePreSynthesized(guildId, audio);
}
