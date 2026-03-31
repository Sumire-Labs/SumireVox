import type Stripe from 'stripe';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';
import { adjustBoostSlots } from './adjust-boost-slots.js';

const SYNC_TTL_SECONDS = 300; // 5分

function syncRedisKey(userId: string): string {
  return `stripe:sync:user:${userId}`;
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  switch (status) {
    case 'active':
      return 'ACTIVE';
    case 'past_due':
      return 'PAST_DUE';
    case 'canceled':
    case 'unpaid':
      return 'CANCELED';
    case 'incomplete':
    case 'incomplete_expired':
    case 'trialing':
    case 'paused':
    default:
      return 'INCOMPLETE';
  }
}

/**
 * 最後の同期から5分以上経過していれば Stripe から最新状態を取得して DB を更新する
 */
export async function syncUserSubscriptionsIfStale(userId: string): Promise<void> {
  if (!stripe) return;
  const redis = getRedisClient();
  const key = syncRedisKey(userId);
  const lastSync = await redis.get(key);
  if (lastSync) return; // まだ有効期限内なのでスキップ

  try {
    await syncUserSubscriptions(userId);
    await redis.set(key, '1', 'EX', SYNC_TTL_SECONDS);
  } catch (err) {
    // 同期失敗はログのみ。レスポンスは続行する
    logger.error({ err, userId }, 'Failed to sync user subscriptions from Stripe');
  }
}

/**
 * ユーザーの全 Stripe サブスクリプションを取得し DB と同期する
 */
export async function syncUserSubscriptions(userId: string): Promise<void> {
  if (!stripe) return;
  const prisma = getPrisma();

  const existingSub = await prisma.subscription.findFirst({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  if (!existingSub?.stripeCustomerId) return;

  const customerId = existingSub.stripeCustomerId;
  const stripeSubscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 100,
  });

  for (const stripeSub of stripeSubscriptions.data) {
    await syncSingleSubscription(userId, customerId, stripeSub);
  }

  logger.info(
    { userId, count: stripeSubscriptions.data.length },
    'User subscriptions synced from Stripe',
  );
}

async function syncSingleSubscription(
  userId: string,
  customerId: string,
  stripeSub: Stripe.Subscription,
): Promise<void> {
  const prisma = getPrisma();
  const status = mapStripeStatus(stripeSub.status);
  const boostCount = stripeSub.items.data[0]?.quantity ?? 0;

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: stripeSub.id },
    include: { boosts: true },
  });

  if (!existing) {
    // DB に存在しない場合は新規作成
    await prisma.subscription.create({
      data: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSub.id,
        status,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        boostCount,
      },
    });
    if (boostCount > 0) {
      const boostData = Array.from({ length: boostCount }, () => ({
        subscriptionId: stripeSub.id,
      }));
      await prisma.boost.createMany({ data: boostData });
    }
    logger.info({ userId, subscriptionId: stripeSub.id, boostCount }, 'New subscription synced');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { stripeSubscriptionId: stripeSub.id },
      data: {
        status,
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        boostCount,
      },
    });

    // ブースト枠数が変化した場合に DB レコードを増減
    const currentCount = existing.boosts.length;
    if (boostCount > currentCount) {
      const toAdd = boostCount - currentCount;
      const boostData = Array.from({ length: toAdd }, () => ({ subscriptionId: stripeSub.id }));
      await tx.boost.createMany({ data: boostData });
      logger.info({ subscriptionId: stripeSub.id, added: toAdd }, 'Boost slots added during sync');
    } else if (boostCount < currentCount) {
      await adjustBoostSlots(tx, stripeSub.id, boostCount, existing.boosts);
    }

    // キャンセル済みの場合は全ブースト割り当てを解除
    if (status === 'CANCELED') {
      await tx.boost.updateMany({
        where: { subscriptionId: stripeSub.id, guildId: { not: null } },
        data: { guildId: null, assignedAt: null, unassignedAt: new Date() },
      });
    }
  });
}

/**
 * 全アクティブユーザーのサブスクリプションを一括同期する（バッチ処理用）
 */
export async function syncAllSubscriptions(): Promise<void> {
  if (!stripe) return;
  const prisma = getPrisma();

  const rows = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
    select: { userId: true },
    distinct: ['userId'],
  });

  logger.info({ count: rows.length }, 'Starting full subscription sync');

  for (const { userId } of rows) {
    try {
      await syncUserSubscriptions(userId);
    } catch (err) {
      logger.error({ err, userId }, 'Failed to sync subscriptions for user during batch sync');
    }
  }

  logger.info({ count: rows.length }, 'Full subscription sync completed');
}
