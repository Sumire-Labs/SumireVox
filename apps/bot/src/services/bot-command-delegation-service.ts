import { randomUUID } from 'node:crypto';
import { REDIS_CHANNELS, REDIS_KEYS } from '@sumirevox/shared';
import { config } from '../infrastructure/config.js';
import { getClient } from '../infrastructure/discord-client.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import {
  createVcSession,
  destroyVcSession,
  getVcSession,
  updateTextChannel,
} from './vc-session-manager.js';
import { getGuildSettings } from './guild-settings-service.js';
import { getPredefinedAudio } from './predefined-audio-cache.js';
import { enqueuePreSynthesized } from './speech-queue.js';

type BotCommand = {
  requestId: string;
  targetShardId: number;
  action: 'join' | 'leave';
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
};

type BotCommandResult = { success: boolean; message?: string };

export async function delegateBotCommand(
  instanceId: number,
  command: Omit<BotCommand, 'requestId' | 'targetShardId'>,
): Promise<BotCommandResult> {
  const requestId = randomUUID();
  if (instanceId === config.botInstanceId) {
    return executeBotCommand({ ...command, requestId, targetShardId: getCurrentShardId() });
  }
  const targetShardId = await getTargetShardId(instanceId, command.guildId);
  if (targetShardId === null) {
    return { success: false, message: '担当Botが対象サーバーで稼働していません。' };
  }
  const payload: BotCommand = { ...command, requestId, targetShardId };
  await publishEvent(REDIS_CHANNELS.BOT_INSTANCE_COMMAND(instanceId), JSON.stringify(payload));
  const key = REDIS_KEYS.BOT_COMMAND_RESULT(requestId);
  for (let attempts = 0; attempts < 120; attempts += 1) {
    const value = await getRedisClient().get(key);
    if (value) {
      await getRedisClient().del(key);
      return JSON.parse(value) as BotCommandResult;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  return { success: false, message: '担当Botから応答がありませんでした。' };
}

export function handleDelegatedBotCommand(message: string): void {
  let command: BotCommand;
  try {
    command = JSON.parse(message) as BotCommand;
  } catch {
    return;
  }
  if (!Number.isInteger(command.targetShardId) || command.targetShardId !== getCurrentShardId()) {
    return;
  }
  void executeAndStore(command);
}

async function getTargetShardId(instanceId: number, guildId: string): Promise<number | null> {
  const value = await getRedisClient().get(REDIS_KEYS.BOT_GUILD_PRESENCE(instanceId, guildId));
  const shardId = value === null ? Number.NaN : Number(value);
  return Number.isInteger(shardId) && shardId >= 0 ? shardId : null;
}

function getCurrentShardId(): number {
  return getClient().shard?.ids[0] ?? 0;
}

async function executeAndStore(command: BotCommand): Promise<void> {
  let result: BotCommandResult;
  try {
    result = await executeBotCommand(command);
  } catch {
    result = { success: false, message: '担当Botの接続処理に失敗しました。' };
  }
  await getRedisClient().set(
    REDIS_KEYS.BOT_COMMAND_RESULT(command.requestId),
    JSON.stringify(result),
    'EX',
    35,
  );
}

async function executeBotCommand(command: BotCommand): Promise<BotCommandResult> {
  const guild = getClient().guilds.cache.get(command.guildId);
  if (!guild) return { success: false, message: 'このBotは対象サーバーに参加していません。' };
  if (command.action === 'leave') {
    const session = getVcSession(command.guildId);
    if (!session || session.voiceChannelId !== command.voiceChannelId) {
      return { success: false, message: '対象VCに接続していません。' };
    }
    await destroyVcSession(command.guildId);
    return { success: true };
  }
  if (!command.textChannelId) return { success: false, message: '読み上げチャンネルが未指定です。' };
  const existingSession = getVcSession(command.guildId);
  if (existingSession) {
    if (existingSession.voiceChannelId !== command.voiceChannelId) {
      return { success: false, message: 'このBotは既に別のVCで使用中です。' };
    }
    await updateTextChannel(command.guildId, command.textChannelId, 'manual');
    return { success: true };
  }
  await createVcSession(command.guildId, command.voiceChannelId, command.textChannelId, guild.voiceAdapterCreator, 'manual');
  const settings = await getGuildSettings(command.guildId);
  if (settings.greetingOnJoin) {
    const audio = await getPredefinedAudio('接続しました', settings.defaultSpeakerId ?? config.defaultSpeakerId, 1.0, 0.0);
    if (audio) enqueuePreSynthesized(command.guildId, audio);
  }
  return { success: true };
}
