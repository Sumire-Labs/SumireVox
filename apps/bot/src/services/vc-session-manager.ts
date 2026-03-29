import { VcSession } from '@sumirevox/shared';
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
import { startDisconnectTimer } from './auto-disconnect-timer.js';

const sessions = new Map<string, VcSession>();
const connections = new Map<string, VoiceConnection>();

export async function createVcSession(
  guildId: string,
  voiceChannelId: string,
  textChannelId: string,
  adapterCreator: DiscordGatewayAdapterCreator,
): Promise<VcSession> {
  const client = getClient();
  const shardId = client.shard?.ids[0] ?? 0;

  const session: VcSession = {
    guildId,
    voiceChannelId,
    textChannelId,
    shardId,
    botInstanceId: config.botInstanceId,
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
  deleteGuildQueue(guildId);

  const connection = connections.get(guildId) ?? getVoiceConnection(guildId);
  if (connection) {
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

export async function updateTextChannel(guildId: string, textChannelId: string): Promise<void> {
  const session = sessions.get(guildId);
  if (!session) return;

  const updated: VcSession = { ...session, textChannelId };
  sessions.set(guildId, updated);
  await saveVcSessionToRedis(updated);

  logger.info({ guildId, textChannelId }, 'Text channel updated');
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
      );

      logger.info(
        { guildId: session.guildId, voiceChannelId: session.voiceChannelId },
        'VC session restored',
      );

      try {
        const humanMembers = voiceChannel.members.filter((member) => !member.user.bot);
        if (humanMembers.size === 0) {
          logger.info(
            { guildId: session.guildId, voiceChannelId: session.voiceChannelId },
            'No human members in restored VC, starting disconnect timer',
          );
          startDisconnectTimer(session.guildId);
        }
      } catch (timerError) {
        logger.warn(
          { err: timerError, guildId: session.guildId },
          'Failed to check human members after session restore',
        );
      }
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
    logger.info({ guildId }, 'Voice connection destroyed');
    sessions.delete(guildId);
    connections.delete(guildId);
    removeVcSessionFromRedis(guildId, config.botInstanceId).catch(() => {});
  });
}
