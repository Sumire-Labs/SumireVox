import { type Subscription } from '@sumirevox/shared';
import { getPrisma } from '../infrastructure/database.js';
import { AppError } from '../infrastructure/app-error.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';
import { getActiveInstanceCount } from './bot-instance-service.js';

export interface GuildBoostInfo {
  guildId: string;
  userBoostCount: number;
  totalGuildBoosts: number;
  isManualPremium: boolean;
}

/**
 * 指定ギルドの全体ブースト数とマニュアルプレミアム状態を取得する
 */
export async function getGuildBoostInfo(
  userId: string,
  guildIds: string[],
): Promise<GuildBoostInfo[]> {
  if (guildIds.length === 0) return [];

  const prisma = getPrisma();

  const [allBoosts, userBoosts, guildSettings] = await Promise.all([
    prisma.boost.findMany({
      where: { guildId: { in: guildIds } },
      select: { guildId: true },
    }),
    prisma.boost.findMany({
      where: {
        guildId: { in: guildIds },
        subscription: { userId },
      },
      select: { guildId: true },
    }),
    prisma.guildSettings.findMany({
      where: { guildId: { in: guildIds } },
      select: { guildId: true, manualPremium: true },
    }),
  ]);

  const totalBoostMap = new Map<string, number>();
  for (const b of allBoosts) {
    if (b.guildId) totalBoostMap.set(b.guildId, (totalBoostMap.get(b.guildId) ?? 0) + 1);
  }

  const userBoostMap = new Map<string, number>();
  for (const b of userBoosts) {
    if (b.guildId) userBoostMap.set(b.guildId, (userBoostMap.get(b.guildId) ?? 0) + 1);
  }

  const manualPremiumMap = new Map(guildSettings.map((s) => [s.guildId, s.manualPremium]));

  return guildIds.map((guildId) => ({
    guildId,
    userBoostCount: userBoostMap.get(guildId) ?? 0,
    totalGuildBoosts: totalBoostMap.get(guildId) ?? 0,
    isManualPremium: manualPremiumMap.get(guildId) ?? false,
  }));
}

export interface BoostWithStatus {
  id: string;
  guildId: string | null;
  assignedAt: Date | null;
  unassignedAt: Date | null;
  cooldownEndsAt: Date | null;
  isOnCooldown: boolean;
}

export interface SubscriptionInfo {
  stripeSubscriptionId: string;
  status: Subscription['status'];
  currentPeriodEnd: Date;
  boostCount: number;
}

export interface BoostAllocation {
  guildId: string;
  boostCount: number;
}

/**
 * ユーザーのブースト枠一覧を取得する
 */
export interface BoostCooldownInfo {
  boostId: string;
  unassignedAt: string;
  availableAt: string;
}

export async function getUserBoosts(userId: string): Promise<{
  boosts: BoostWithStatus[];
  subscription: SubscriptionInfo | null;
  totalBoosts: number;
  usedBoosts: number;
  cooldownBoosts: number;
  availableBoosts: number;
  maxBoostsPerGuild: number;
  allocations: BoostAllocation[];
  cooldowns: BoostCooldownInfo[];
}> {
  const prisma = getPrisma();

  const [subscriptions, maxBoostsPerGuild] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
      include: { boosts: true },
      orderBy: { createdAt: 'desc' },
    }),
    getActiveInstanceCount(),
  ]);

  if (subscriptions.length === 0) {
    return { boosts: [], subscription: null, totalBoosts: 0, usedBoosts: 0, cooldownBoosts: 0, availableBoosts: 0, maxBoostsPerGuild, allocations: [], cooldowns: [] };
  }

  const cooldownMs = config.boostCooldownDays * 24 * 60 * 60 * 1000;

  // 全サブスクリプションのブーストをフラットに収集
  const boosts: BoostWithStatus[] = subscriptions.flatMap((sub) =>
    sub.boosts.map((boost) => {
      const cooldownEndsAt = boost.unassignedAt
        ? new Date(boost.unassignedAt.getTime() + cooldownMs)
        : null;
      return {
        id: boost.id,
        guildId: boost.guildId,
        assignedAt: boost.assignedAt,
        unassignedAt: boost.unassignedAt,
        cooldownEndsAt,
        isOnCooldown: cooldownEndsAt !== null && Date.now() < cooldownEndsAt.getTime(),
      };
    }),
  );
  const activeBoostIds = new Set(
    subscriptions
      .filter((sub) => sub.status === 'ACTIVE')
      .flatMap((sub) => sub.boosts.map((boost) => boost.id)),
  );

  const sub = subscriptions[0]; // 最新のサブスクリプションを代表値として使用
  const totalBoostCount = subscriptions.reduce((sum, s) => sum + s.boostCount, 0);

  // ギルドごとの割り当て集計
  const allocationMap = new Map<string, number>();
  let usedBoosts = 0;
  for (const boost of boosts) {
    if (boost.guildId && activeBoostIds.has(boost.id)) {
      usedBoosts++;
      allocationMap.set(boost.guildId, (allocationMap.get(boost.guildId) ?? 0) + 1);
    }
  }
  const cooldownBoosts = boosts.filter((b) => activeBoostIds.has(b.id) && !b.guildId && b.isOnCooldown).length;
  const availableBoosts = boosts.filter((b) => activeBoostIds.has(b.id) && !b.guildId && !b.isOnCooldown).length;
  const cooldowns: BoostCooldownInfo[] = boosts
    .filter((b) => activeBoostIds.has(b.id) && !b.guildId && b.isOnCooldown && b.unassignedAt !== null && b.cooldownEndsAt !== null)
    .map((b) => ({
      boostId: b.id,
      unassignedAt: b.unassignedAt!.toISOString(),
      availableAt: b.cooldownEndsAt!.toISOString(),
    }));
  const allocations: BoostAllocation[] = Array.from(allocationMap.entries()).map(([guildId, boostCount]) => ({
    guildId,
    boostCount,
  }));

  return {
    boosts,
    subscription: {
      stripeSubscriptionId: sub.stripeSubscriptionId,
      status: sub.status as Subscription['status'],
      currentPeriodEnd: sub.currentPeriodEnd,
      boostCount: totalBoostCount,
    },
    totalBoosts: boosts.length,
    usedBoosts,
    cooldownBoosts,
    availableBoosts,
    maxBoostsPerGuild,
    allocations,
    cooldowns,
  };
}

/**
 * ギルドへのブースト割り当て数を設定する（増減を自動処理）
 */
export async function setGuildBoostCount(userId: string, guildId: string, count: number): Promise<void> {
  const prisma = getPrisma();

  await prisma.$transaction(async (tx) => {
    const subscriptions = await tx.subscription.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { boosts: true },
    });

    if (subscriptions.length === 0) {
      throw new AppError('NOT_FOUND', 'サブスクリプションが見つかりません。', 404);
    }

    const allBoosts = subscriptions.flatMap((s) => s.boosts);
    const guildBoosts = allBoosts.filter((b) => b.guildId === guildId);
    const currentCount = guildBoosts.length;
    const delta = count - currentCount;

    if (delta === 0) return;

    if (delta > 0) {
      const maxBoostsPerGuild = await getActiveInstanceCount();
      const totalGuildBoosts = await tx.boost.count({
        where: { guildId, subscription: { status: 'ACTIVE' } },
      });
      const requestedTotalGuildBoosts = totalGuildBoosts + delta;
      if (maxBoostsPerGuild > 0 && requestedTotalGuildBoosts > maxBoostsPerGuild) {
        throw new AppError('GUILD_BOOST_LIMIT_REACHED', 'このサーバーは最大ブースト数に達しています。', 400);
      }

      const cooldownMs = config.boostCooldownDays * 24 * 60 * 60 * 1000;
      const availableBoosts = allBoosts.filter((b) => {
        if (b.guildId !== null) return false;
        if (b.unassignedAt && Date.now() < b.unassignedAt.getTime() + cooldownMs) return false;
        return true;
      });

      if (availableBoosts.length < delta) {
        throw new AppError(
          'BOOST_LIMIT_REACHED',
          `未割り当てブーストが不足しています。利用可能: ${availableBoosts.length}、必要: ${delta}`,
          400,
        );
      }

      const toAssign = availableBoosts.slice(0, delta);
      await tx.boost.updateMany({
        where: { id: { in: toAssign.map((b) => b.id) } },
        data: { guildId, assignedAt: new Date(), unassignedAt: null },
      });

      logger.info({ userId, guildId, delta }, 'Boosts assigned to guild');
    } else {
      const toUnassign = guildBoosts.slice(0, Math.abs(delta));
      await tx.boost.updateMany({
        where: { id: { in: toUnassign.map((b) => b.id) } },
        data: { guildId: null, assignedAt: null, unassignedAt: new Date() },
      });

      logger.info({ userId, guildId, delta }, 'Boosts unassigned from guild');
    }
  });
}

/**
 * ブースト枠をサーバーに割り当てる
 */
export async function assignBoost(
  userId: string,
  boostId: string,
  guildId: string,
): Promise<void> {
  const prisma = getPrisma();
  const maxBoostsPerGuild = await getActiveInstanceCount();

  const boost = await prisma.boost.findUnique({
    where: { id: boostId },
    include: { subscription: true },
  });

  if (!boost) {
    throw new AppError('NOT_FOUND', 'ブースト枠が見つかりません。', 404);
  }

  if (boost.subscription.userId !== userId) {
    throw new AppError('FORBIDDEN', 'このブースト枠の所有者ではありません。', 403);
  }

  if (boost.subscription.status !== 'ACTIVE') {
    throw new AppError('VALIDATION_ERROR', 'サブスクリプションが有効ではありません。', 400);
  }

  if (boost.guildId) {
    throw new AppError('VALIDATION_ERROR', 'このブースト枠は既にサーバーに割り当てられています。', 400);
  }

  if (boost.unassignedAt) {
    const cooldownEnd = boost.unassignedAt.getTime() + config.boostCooldownDays * 24 * 60 * 60 * 1000;
    if (Date.now() < cooldownEnd) {
      const remaining = Math.ceil((cooldownEnd - Date.now()) / (24 * 60 * 60 * 1000));
      throw new AppError(
        'BOOST_COOLDOWN',
        `クールダウン中です。あと約${remaining}日後に割り当て可能になります。`,
        400,
      );
    }
  }

  const totalGuildBoosts = await prisma.boost.count({
    where: {
      guildId,
      subscription: {
        status: 'ACTIVE',
      },
    },
  });

  if (maxBoostsPerGuild > 0 && totalGuildBoosts >= maxBoostsPerGuild) {
    throw new AppError('GUILD_BOOST_LIMIT_REACHED', 'このサーバーは最大ブースト数に達しています。', 400);
  }

  await prisma.boost.update({
    where: { id: boostId },
    data: {
      guildId,
      assignedAt: new Date(),
      unassignedAt: null,
    },
  });

  logger.info({ userId, boostId, guildId }, 'Boost assigned');
}

/**
 * ブースト枠をサーバーから外す
 */
export async function unassignBoost(userId: string, boostId: string): Promise<void> {
  const prisma = getPrisma();

  const boost = await prisma.boost.findUnique({
    where: { id: boostId },
    include: { subscription: true },
  });

  if (!boost) {
    throw new AppError('NOT_FOUND', 'ブースト枠が見つかりません。', 404);
  }

  if (boost.subscription.userId !== userId) {
    throw new AppError('FORBIDDEN', 'このブースト枠の所有者ではありません。', 403);
  }

  if (!boost.guildId) {
    throw new AppError('VALIDATION_ERROR', 'このブースト枠はサーバーに割り当てられていません。', 400);
  }

  await prisma.boost.update({
    where: { id: boostId },
    data: {
      guildId: null,
      assignedAt: null,
      unassignedAt: new Date(),
    },
  });

  logger.info({ userId, boostId, previousGuildId: boost.guildId }, 'Boost unassigned');
}

/**
 * ブースト整合処理: アクティブインスタンス数を超えるギルドブーストを自動解除する
 * アクティブインスタンス減少時にクールダウンなしで超過分を解除する
 */
export async function reconcileBoosts(): Promise<void> {
  const prisma = getPrisma();
  const maxBoosts = await getActiveInstanceCount();

  const guildBoosts = await prisma.boost.groupBy({
    by: ['guildId'],
    where: {
      guildId: { not: null },
      subscription: { status: 'ACTIVE' },
    },
    _count: { id: true },
  });

  for (const group of guildBoosts) {
    if (!group.guildId) continue;
    const currentCount = group._count.id;
    if (currentCount <= maxBoosts) continue;

    const excess = currentCount - maxBoosts;
    const boostsToRemove = await prisma.boost.findMany({
      where: {
        guildId: group.guildId,
        subscription: { status: 'ACTIVE' },
      },
      orderBy: { assignedAt: 'desc' },
      take: excess,
    });

    await prisma.boost.updateMany({
      where: { id: { in: boostsToRemove.map((b) => b.id) } },
      data: {
        guildId: null,
        assignedAt: null,
        unassignedAt: null,
      },
    });

    logger.info(
      { guildId: group.guildId, removed: excess, maxBoosts },
      'Boost reconciliation: excess boosts removed without cooldown',
    );
  }
}
