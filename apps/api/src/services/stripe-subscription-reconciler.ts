import Stripe from 'stripe';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { logger } from '../infrastructure/logger.js';
import { mapStripeStatus } from './stripe-utils.js';
import { adjustBoostSlots } from './adjust-boost-slots.js';
import { publishGuildPremiumInvalidation } from './premium-cache-sync.js';

interface BoostRecord {
  id: string;
  guildId: string | null;
  assignedAt: Date | null;
}

interface ReconcileSubject {
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date;
  boostCount: number;
  boosts: BoostRecord[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reconcileStripeSubscriptions(): Promise<void> {
  if (!stripe) {
    return;
  }

  logger.info('Starting Stripe subscription reconciliation');
  const prisma = getPrisma();

  const subscriptions = await prisma.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'PAST_DUE'] } },
    include: { boosts: { select: { id: true, guildId: true, assignedAt: true } } },
  });

  logger.info({ count: subscriptions.length }, 'Fetched active subscriptions for reconciliation');

  let repairedCount = 0;

  for (const sub of subscriptions) {
    await delay(200);

    try {
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const repaired = await processSubscription(sub, stripeSub);
      if (repaired) repairedCount++;
    } catch (error: unknown) {
      if (error instanceof Stripe.errors.StripeError && error.statusCode === 404) {
        logger.warn({ subscriptionId: sub.stripeSubscriptionId }, 'Subscription not found in Stripe, marking CANCELED');
        await cancelAndUnassign(sub);
        repairedCount++;
      } else {
        logger.error({ err: error, subscriptionId: sub.stripeSubscriptionId }, 'Failed to reconcile subscription, skipping');
      }
    }
  }

  logger.info({ total: subscriptions.length, repaired: repairedCount }, 'Stripe subscription reconciliation complete');
}

async function processSubscription(sub: ReconcileSubject, stripeSub: Stripe.Subscription): Promise<boolean> {
  if (stripeSub.status === 'canceled' || stripeSub.status === 'incomplete_expired') {
    await cancelAndUnassign(sub);
    logger.info(
      { subscriptionId: sub.stripeSubscriptionId, stripeStatus: stripeSub.status },
      'Reconciled: subscription marked CANCELED',
    );
    return true;
  }

  const newStatus = mapStripeStatus(stripeSub.status);
  const newBoostCount = stripeSub.items.data[0]?.quantity ?? 0;
  const newPeriodEnd = new Date(stripeSub.current_period_end * 1000);

  const statusChanged = newStatus !== sub.status;
  const boostCountChanged = newBoostCount !== sub.boostCount;
  const periodEndChanged = newPeriodEnd.getTime() !== sub.currentPeriodEnd.getTime();

  if (!statusChanged && !boostCountChanged && !periodEndChanged) {
    return false;
  }

  logger.info(
    { subscriptionId: sub.stripeSubscriptionId, statusChanged, boostCountChanged, periodEndChanged },
    'Reconciling subscription drift',
  );

  const prisma = getPrisma();
  const assignedBoosts = sub.boosts.filter((b) => b.guildId !== null);
  const affectedGuildIds = assignedBoosts.map((b) => b.guildId);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { stripeSubscriptionId: sub.stripeSubscriptionId },
      data: { status: newStatus, currentPeriodEnd: newPeriodEnd, boostCount: newBoostCount },
    });

    // PAST_DUE: 割り当て済みブーストを即時解除（クールダウンなし）
    if (newStatus === 'PAST_DUE' && assignedBoosts.length > 0) {
      await tx.boost.updateMany({
        where: { subscriptionId: sub.stripeSubscriptionId, guildId: { not: null } },
        data: { guildId: null, assignedAt: null, unassignedAt: null },
      });
    }

    if (boostCountChanged) {
      const currentCount = sub.boosts.length;
      if (newBoostCount > currentCount) {
        await tx.boost.createMany({
          data: Array.from({ length: newBoostCount - currentCount }, () => ({ subscriptionId: sub.stripeSubscriptionId })),
        });
        logger.info(
          { subscriptionId: sub.stripeSubscriptionId, added: newBoostCount - currentCount },
          'Boost slots added during reconciliation',
        );
      } else if (newBoostCount < currentCount) {
        await adjustBoostSlots(tx, sub.stripeSubscriptionId, newBoostCount, sub.boosts);
      }
    }
  });

  await publishGuildPremiumInvalidation(affectedGuildIds);
  return true;
}

async function cancelAndUnassign(sub: ReconcileSubject): Promise<void> {
  const prisma = getPrisma();
  const assignedBoosts = sub.boosts.filter((b) => b.guildId !== null);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { stripeSubscriptionId: sub.stripeSubscriptionId },
      data: { status: 'CANCELED' },
    });

    if (assignedBoosts.length > 0) {
      await tx.boost.updateMany({
        where: { subscriptionId: sub.stripeSubscriptionId, guildId: { not: null } },
        data: { guildId: null, assignedAt: null, unassignedAt: new Date() },
      });
    }
  });

  await publishGuildPremiumInvalidation(assignedBoosts.map((b) => b.guildId));
}
