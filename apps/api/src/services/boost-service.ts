import { type Subscription } from '@sumirevox/shared';
import { getPrisma } from '../infrastructure/database.js';
import { AppError } from '../infrastructure/app-error.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

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

/**
 * ユーザーのブースト枠一覧を取得する
 */
export async function getUserBoosts(userId: string): Promise<{
  boosts: BoostWithStatus[];
  subscription: SubscriptionInfo | null;
}> {
  const prisma = getPrisma();

  const subscriptions = await prisma.subscription.findMany({
    where: { userId, status: { in: ['ACTIVE', 'PAST_DUE'] } },
    include: { boosts: true },
    orderBy: { createdAt: 'desc' },
  });

  if (subscriptions.length === 0) {
    return { boosts: [], subscription: null };
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

  const sub = subscriptions[0]; // 最新のサブスクリプションを代表値として使用
  const totalBoostCount = subscriptions.reduce((sum, s) => sum + s.boostCount, 0);

  return {
    boosts,
    subscription: {
      stripeSubscriptionId: sub.stripeSubscriptionId,
      status: sub.status as Subscription['status'],
      currentPeriodEnd: sub.currentPeriodEnd,
      boostCount: totalBoostCount,
    },
  };
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
