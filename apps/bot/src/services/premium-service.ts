import { getPrisma } from '../infrastructure/database.js';
import { getGuildSettings } from './guild-settings-service.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { REDIS_KEYS } from '@sumirevox/shared';

const PREMIUM_CACHE_TTL_MS = 60_000;

const premiumCache = new Map<string, { isPremium: boolean; cachedAt: number }>();

export function invalidatePremiumCache(guildId: string): void {
  premiumCache.delete(guildId);
}

export function clearPremiumCache(): void {
  premiumCache.clear();
}

/**
 * サーバーが PREMIUM かどうかを判定する
 * manualPremium が true、または有効なブーストが1つ以上ある場合に PREMIUM
 * ブースト判定結果は60秒間インメモリキャッシュする
 */
export async function isGuildPremium(guildId: string): Promise<boolean> {
  const settings = await getGuildSettings(guildId);

  if (settings.manualPremium) return true;

  const cached = premiumCache.get(guildId);
  if (cached !== undefined && Date.now() - cached.cachedAt < PREMIUM_CACHE_TTL_MS) {
    return cached.isPremium;
  }

  const prisma = getPrisma();
  const activeBoost = await prisma.boost.findFirst({
    where: {
      guildId,
      subscription: {
        status: 'ACTIVE',
      },
    },
  });

  const isPremium = activeBoost !== null;
  premiumCache.set(guildId, { isPremium, cachedAt: Date.now() });

  return isPremium;
}

/**
 * サーバーに割り当てられたアクティブなブーストの数を返す
 */
export async function getGuildActiveBoostCount(guildId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.boost.count({
    where: {
      guildId,
      subscription: {
        status: 'ACTIVE',
      },
    },
  });
}

/**
 * 指定インスタンスがそのサーバーに接続できるかを判定する
 *
 * 利用可能なBot台数 = max(1, ブースト数)
 * - 1号機は常に接続可能
 * - N号機 (N >= 2) はブースト数 >= N の場合のみ接続可能
 * - manualPremium が true の場合は全インスタンスで接続可能
 */
export async function canInstanceConnect(guildId: string, instanceId: number): Promise<boolean> {
  if (instanceId <= 1) return true;

  const settings = await getGuildSettings(guildId);
  if (settings.manualPremium) return true;

  const boostCount = await getGuildActiveBoostCount(guildId);
  return boostCount >= instanceId;
}

/** 優先順位とBoost枠を反映した、このギルドで自動接続可能なBot一覧。 */
export async function getAvailableBotInstanceIds(guildId: string): Promise<number[]> {
  const [settings, records] = await Promise.all([
    getGuildSettings(guildId),
    getPrisma().botInstance.findMany({ where: { isActive: true }, orderBy: { instanceId: 'asc' } }),
  ]);
  const present = await Promise.all(records.map(async (record) => ({
    id: record.instanceId,
    present: (await getRedisClient().exists(REDIS_KEYS.BOT_GUILD_PRESENCE(record.instanceId, guildId))) === 1,
  })));
  const joinedIds = present.filter((item) => item.present).map((item) => item.id);
  const stored = Array.isArray(settings.botInstancePriority)
    ? settings.botInstancePriority.filter((id): id is number => typeof id === 'number' && joinedIds.includes(id))
    : [];
  const priority = [...new Set([...stored, ...joinedIds.filter((id) => !stored.includes(id)).sort((a, b) => a - b)])];
  const max = settings.manualPremium
    ? priority.length
    : Math.min(priority.length, Math.max(1, await getGuildActiveBoostCount(guildId)));
  return priority.slice(0, max);
}
