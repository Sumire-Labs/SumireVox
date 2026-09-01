import type { BotInstance } from '@sumirevox/shared';
import { getPrisma } from '../infrastructure/database.js';
import { getClient } from '../infrastructure/discord-client.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { REDIS_KEYS } from '@sumirevox/shared';

export async function registerBotInstance(): Promise<void> {
  const client = getClient();
  const botUserId = client.user!.id;
  const name = client.user!.username;

  await getPrisma().botInstance.upsert({
    where: { instanceId: config.botInstanceId },
    create: {
      instanceId: config.botInstanceId,
      botUserId,
      clientId: config.discordClientId,
      name,
      isActive: true,
    },
    update: {
      botUserId,
      clientId: config.discordClientId,
      name,
      isActive: true,
    },
  });

  logger.info(
    { instanceId: config.botInstanceId, username: name },
    `Bot instance ${config.botInstanceId} registered (${name})`,
  );
}

export async function deactivateBotInstance(): Promise<void> {
  await getPrisma().botInstance.updateMany({
    where: { instanceId: config.botInstanceId },
    data: { isActive: false },
  });

  logger.info({ instanceId: config.botInstanceId }, 'Bot instance deactivated');
}

/**
 * 設定コピーの対象として扱える Bot インスタンスを取得する。
 * Boost/Premium による接続可否は設定コピーとは別のため、ここでは判定しない。
 */
export async function getCopyableBotInstances(
  guildId: string,
  sourceInstanceId: number,
): Promise<BotInstance[]> {
  const records = await getPrisma().botInstance.findMany({
    where: { isActive: true },
    orderBy: { instanceId: 'asc' },
  });
  const candidates = records.filter((record) => record.instanceId !== sourceInstanceId);
  const redis = getRedisClient();

  const available = await Promise.all(
    candidates.map(async (record) => {
      try {
        const isInGuild = (await redis.sismember(REDIS_KEYS.BOT_GUILDS(record.instanceId), guildId)) === 1;
        return isInGuild ? mapBotInstance(record) : null;
      } catch (error) {
        logger.warn(
          { err: error, guildId, instanceId: record.instanceId },
          'Failed to check Bot guild membership for settings copy',
        );
        return null;
      }
    }),
  );

  return available.filter((instance): instance is BotInstance => instance !== null);
}

function mapBotInstance(record: {
  instanceId: number;
  botUserId: string;
  clientId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): BotInstance {
  return {
    instanceId: record.instanceId,
    botUserId: record.botUserId,
    clientId: record.clientId,
    name: record.name,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
