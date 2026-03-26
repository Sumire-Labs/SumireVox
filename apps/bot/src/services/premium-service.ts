import { getPrisma } from '../infrastructure/database.js';
import { getGuildSettings } from './guild-settings-service.js';

/**
 * サーバーが PREMIUM かどうかを判定する
 * manualPremium が true、または有効なブーストが1つ以上ある場合に PREMIUM
 */
export async function isGuildPremium(guildId: string): Promise<boolean> {
  const settings = await getGuildSettings(guildId);

  if (settings.manualPremium) return true;

  const prisma = getPrisma();
  const activeBoost = await prisma.boost.findFirst({
    where: {
      guildId,
      subscription: {
        status: 'ACTIVE',
      },
    },
  });

  return activeBoost !== null;
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
