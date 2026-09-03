import { randomUUID } from 'node:crypto';
import { REDIS_CHANNELS, REDIS_KEYS } from '@sumirevox/shared';
import { config } from '../infrastructure/config.js';
import { getClient } from '../infrastructure/discord-client.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import { createVcSession, destroyVcSession, getVcSession } from './vc-session-manager.js';
import { getGuildSettings } from './guild-settings-service.js';
import { getPredefinedAudio } from './predefined-audio-cache.js';
import { enqueuePreSynthesized } from './speech-queue.js';

type BotCommand = {
  requestId: string;
  action: 'join' | 'leave';
  guildId: string;
  voiceChannelId: string;
  textChannelId?: string;
};

type BotCommandResult = { success: boolean; message?: string };

export async function delegateBotCommand(
  instanceId: number,
  command: Omit<BotCommand, 'requestId'>,
): Promise<BotCommandResult> {
  const requestId = randomUUID();
  const payload: BotCommand = { ...command, requestId };
  if (instanceId === config.botInstanceId) {
    return executeBotCommand(payload);
  }
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
  void executeAndStore(command);
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
  if (getVcSession(command.guildId)) return { success: false, message: 'このBotは既に別のVCで使用中です。' };
  await createVcSession(command.guildId, command.voiceChannelId, command.textChannelId, guild.voiceAdapterCreator, 'manual');
  const settings = await getGuildSettings(command.guildId);
  if (settings.greetingOnJoin) {
    const audio = await getPredefinedAudio('接続しました', settings.defaultSpeakerId ?? config.defaultSpeakerId, 1.0, 0.0);
    if (audio) enqueuePreSynthesized(command.guildId, audio);
  }
  return { success: true };
}
