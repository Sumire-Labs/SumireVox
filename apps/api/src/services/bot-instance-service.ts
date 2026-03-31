import {
  BotInstance,
  BotInstanceSettings,
  GuildBotInstanceSettingsMap,
  DEFAULT_BOT_INSTANCE_SETTINGS,
  LIMITS,
} from '@sumirevox/shared';
import { getPrisma } from '../infrastructure/database.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { REDIS_KEYS } from '@sumirevox/shared';
import { AppError } from '../infrastructure/app-error.js';

const ACTIVE_INSTANCE_COUNT_CACHE_KEY = 'bot:instances:active:count';
const ACTIVE_INSTANCE_COUNT_CACHE_TTL = 300;

/**
 * アクティブな Bot インスタンス数を取得（Redis キャッシュ付き）
 */
export async function getActiveInstanceCount(): Promise<number> {
  try {
    const cached = await getRedisClient().get(ACTIVE_INSTANCE_COUNT_CACHE_KEY);
    if (cached !== null) return parseInt(cached, 10);
  } catch {
    // Redis 読み取り失敗時は DB にフォールバック
  }

  const prisma = getPrisma();
  const count = await prisma.botInstance.count({ where: { isActive: true } });

  try {
    await getRedisClient().set(ACTIVE_INSTANCE_COUNT_CACHE_KEY, String(count), 'EX', ACTIVE_INSTANCE_COUNT_CACHE_TTL);
  } catch {
    // キャッシュ書き込み失敗は無視
  }

  return count;
}

/**
 * 全アクティブな Bot インスタンスを取得
 */
export async function getActiveBotInstances(): Promise<BotInstance[]> {
  const prisma = getPrisma();
  const instances = await prisma.botInstance.findMany({
    where: { isActive: true },
    orderBy: { instanceId: 'asc' },
  });
  return instances.map((i) => ({
    instanceId: i.instanceId,
    botUserId: i.botUserId,
    clientId: i.clientId,
    name: i.name,
    isActive: i.isActive,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));
}

/**
 * 全 Bot インスタンスを取得（管理者向け）
 */
export async function getAllBotInstances(): Promise<BotInstance[]> {
  const prisma = getPrisma();
  const instances = await prisma.botInstance.findMany({
    orderBy: { instanceId: 'asc' },
  });
  return instances.map((i) => ({
    instanceId: i.instanceId,
    botUserId: i.botUserId,
    clientId: i.clientId,
    name: i.name,
    isActive: i.isActive,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));
}

/**
 * 特定の Bot インスタンスを取得
 */
export async function getBotInstance(instanceId: number): Promise<BotInstance | null> {
  const prisma = getPrisma();
  const instance = await prisma.botInstance.findUnique({ where: { instanceId } });
  if (!instance) return null;
  return {
    instanceId: instance.instanceId,
    botUserId: instance.botUserId,
    clientId: instance.clientId,
    name: instance.name,
    isActive: instance.isActive,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  };
}

/**
 * サーバーが利用可能な Bot インスタンス数を取得（ブーストレベルに基づく）
 *
 * FREE (0 boosts) → 1台
 * 1 boost → 1台（PREMIUM だが追加 Bot なし）
 * 2 boosts → 2台
 * 3+ boosts → 最大 MAX_BOT_INSTANCES 台
 */
export async function getAvailableBotCount(guildId: string): Promise<number> {
  const prisma = getPrisma();

  // manualPremium チェック
  const guildSettings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (guildSettings?.manualPremium) {
    return LIMITS.MAX_BOT_INSTANCES;
  }

  const boostCount = await prisma.boost.count({
    where: {
      guildId,
      subscription: { status: 'ACTIVE' },
    },
  });

  if (boostCount <= 1) return 1;
  return Math.min(boostCount, LIMITS.MAX_BOT_INSTANCES);
}

/**
 * ギルドのアクティブブースト数を取得
 * manualPremium の場合は MAX_BOT_INSTANCES を返す
 */
export async function getGuildBoostCount(guildId: string): Promise<number> {
  const prisma = getPrisma();
  const guildSettings = await prisma.guildSettings.findUnique({ where: { guildId } });
  if (guildSettings?.manualPremium) return LIMITS.MAX_BOT_INSTANCES;
  return prisma.boost.count({
    where: { guildId, subscription: { status: 'ACTIVE' } },
  });
}

/**
 * サーバーの Bot インスタンス別設定を取得
 */
export async function getGuildBotInstanceSettings(guildId: string): Promise<GuildBotInstanceSettingsMap> {
  const prisma = getPrisma();
  const settings = await prisma.guildSettings.findUnique({ where: { guildId } });
  return ((settings?.botInstanceSettings ?? {}) as unknown) as GuildBotInstanceSettingsMap;
}

export interface GuildBotListItem {
  instanceNumber: number;
  name: string;
  botUserId: string;
  isActive: boolean;
  isInGuild: boolean;
  isAvailable: boolean;
  settings: BotInstanceSettings | null;
}

export interface GuildBotListResult {
  bots: GuildBotListItem[];
  boostCount: number;
  maxBots: number;
}

export async function getGuildBotList(guildId: string): Promise<GuildBotListResult> {
  const [instances, availableCount, boostCount, instanceSettingsMap] = await Promise.all([
    getActiveBotInstances(),
    getAvailableBotCount(guildId),
    getGuildBoostCount(guildId),
    getGuildBotInstanceSettings(guildId),
  ]);

  const bots = await Promise.all(
    instances.map(async (instance) => {
      const isInGuild = await isBotInGuild(instance.instanceId, guildId);
      const isAvailable = instance.instanceId <= availableCount;
      const settings = isAvailable
        ? (instanceSettingsMap[String(instance.instanceId)] ?? {
            ...DEFAULT_BOT_INSTANCE_SETTINGS,
          })
        : null;

      return {
        instanceNumber: instance.instanceId,
        name: instance.name,
        botUserId: instance.botUserId,
        isActive: instance.isActive,
        isInGuild,
        isAvailable,
        settings,
      };
    }),
  );

  return {
    bots,
    boostCount,
    maxBots: availableCount,
  };
}

/**
 * サーバーの特定インスタンスの設定を更新
 */
export async function updateGuildBotInstanceSettings(
  guildId: string,
  instanceId: number,
  settings: Partial<BotInstanceSettings>,
): Promise<void> {
  const prisma = getPrisma();

  const current = await getGuildBotInstanceSettings(guildId);
  const instanceKey = String(instanceId);
  const existing: BotInstanceSettings = current[instanceKey] ?? { ...DEFAULT_BOT_INSTANCE_SETTINGS };

  const updated: GuildBotInstanceSettingsMap = {
    ...current,
    [instanceKey]: {
      autoJoin: settings.autoJoin ?? existing.autoJoin,
      textChannelId: settings.textChannelId !== undefined ? settings.textChannelId : existing.textChannelId,
      voiceChannelId: settings.voiceChannelId !== undefined ? settings.voiceChannelId : existing.voiceChannelId,
    },
  };

  await prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId, botInstanceSettings: updated as object },
    update: { botInstanceSettings: updated as object },
  });
}

/**
 * サーバーの Bot 招待 URL を生成
 */
export async function generateBotInviteUrl(instanceId: number, guildId: string): Promise<string> {
  const instance = await getBotInstance(instanceId);
  if (!instance) {
    throw new AppError('NOT_FOUND', 'Bot インスタンスが見つかりません。', 404);
  }

  // Connect, Speak, ViewChannel, SendMessages, ReadMessageHistory, UseVoiceActivity
  const permissions = '36727824';
  return `https://discord.com/api/oauth2/authorize?client_id=${instance.clientId}&permissions=${permissions}&scope=bot&guild_id=${guildId}`;
}

/**
 * Bot がサーバーに参加しているかチェック（Redis Set を参照）
 */
export async function isBotInGuild(instanceId: number, guildId: string): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const result = await redis.sismember(REDIS_KEYS.BOT_GUILDS(instanceId), guildId);
    return result === 1;
  } catch {
    return false;
  }
}

/**
 * 複数ギルドに Bot が参加しているかを一括チェック
 * 1つでもアクティブな Bot インスタンスが参加していれば true
 */
export async function getGuildsWithBotStatus(
  guildIds: string[],
  instances: BotInstance[],
): Promise<Map<string, boolean>> {
  const guildStatusMap = new Map<string, boolean>(guildIds.map((guildId) => [guildId, false]));

  if (guildIds.length === 0 || instances.length === 0) {
    return guildStatusMap;
  }

  try {
    const redis = getRedisClient();
    const pipeline = redis.pipeline();

    for (const guildId of guildIds) {
      for (const instance of instances) {
        pipeline.sismember(REDIS_KEYS.BOT_GUILDS(instance.instanceId), guildId);
      }
    }

    const results = await pipeline.exec();
    if (!results) {
      return guildStatusMap;
    }

    let resultIndex = 0;
    for (const guildId of guildIds) {
      let botJoined = false;

      for (let instanceIndex = 0; instanceIndex < instances.length; instanceIndex += 1) {
        const [error, result] = results[resultIndex] ?? [];
        resultIndex += 1;

        if (error) {
          continue;
        }

        if (result === 1) {
          botJoined = true;
        }
      }

      guildStatusMap.set(guildId, botJoined);
    }

    return guildStatusMap;
  } catch {
    return guildStatusMap;
  }
}

/**
 * Bot インスタンスのアクティブ状態を更新（管理者向け）
 */
export async function setBotInstanceActive(instanceId: number, isActive: boolean): Promise<BotInstance> {
  const prisma = getPrisma();
  const instance = await prisma.botInstance.update({
    where: { instanceId },
    data: { isActive },
  });

  // アクティブインスタンス数のキャッシュをクリア
  try {
    await getRedisClient().del(ACTIVE_INSTANCE_COUNT_CACHE_KEY);
  } catch {
    // キャッシュ削除失敗は無視
  }

  // インスタンスが非アクティブ化された場合、ブースト整合処理を実行
  if (!isActive) {
    const { reconcileBoosts } = await import('./boost-service.js');
    await reconcileBoosts();
  }

  return {
    instanceId: instance.instanceId,
    botUserId: instance.botUserId,
    clientId: instance.clientId,
    name: instance.name,
    isActive: instance.isActive,
    createdAt: instance.createdAt,
    updatedAt: instance.updatedAt,
  };
}
