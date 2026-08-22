import Stripe from 'stripe';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { logger } from '../infrastructure/logger.js';
import { adjustBoostSlots } from './adjust-boost-slots.js';
import { publishGuildPremiumInvalidation } from './premium-cache-sync.js';
import { mapStripeStatus } from './stripe-utils.js';

/**
 * Stripe API が resource_missing（404）を返したかを判定する。
 * リトライ遅延中に対象リソース（サブスクリプション等）が Stripe 上で削除済みの場合、
 * 成功扱いにしてスキップするための判定。
 */
function isStripeResourceMissing(error: unknown): boolean {
  return error instanceof Stripe.errors.StripeError && error.statusCode === 404;
}

/**
 * 永続化済み（outbox）の Stripe Webhook イベントを処理する。
 *
 * イベントの受信・永続化は stripe-event-outbox.ts が担う。本関数は業務処理のみを行い、
 * 冪等性マーカ（stripe_events レコード）の生成はしない（outbox 側で管理する）。
 */
export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  logger.info({ type: event.type, id: event.id }, 'Processing Stripe webhook event');

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        logger.debug({ type: event.type }, 'Unhandled webhook event type');
    }
  } catch (error) {
    // リトライ遅延中に対象リソースが Stripe 上で削除済み（resource_missing）の場合も
    // 成功扱いでスキップする。残状態は定期整合処理が修復する。
    if (isStripeResourceMissing(error)) {
      logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook resource missing, skipping');
      return;
    }

    throw error;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.userId;
  const boostCount = parseInt(session.metadata?.boostCount ?? '0', 10);
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId || !subscriptionId || !customerId) {
    logger.warn({ sessionId: session.id }, 'Checkout completed but missing metadata');
    return;
  }

  const prisma = getPrisma();
  // stripe は enqueue 時点（ルート）と drain 時点（outbox）で有効性を検査済み
  const stripeSubscription = await stripe!.subscriptions.retrieve(subscriptionId);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.upsert({
      where: { stripeSubscriptionId: subscriptionId },
      create: {
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
        status: 'ACTIVE',
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        boostCount,
      },
      update: {
        status: 'ACTIVE',
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        boostCount,
      },
    });

    const existingBoostCount = await tx.boost.count({ where: { subscriptionId } });
    const toAdd = boostCount - existingBoostCount;
    if (toAdd > 0) {
      const boostData = Array.from({ length: toAdd }, () => ({ subscriptionId }));
      await tx.boost.createMany({ data: boostData });
    }
  });

  logger.info({ userId, subscriptionId, boostCount }, 'Subscription created from checkout');
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const prisma = getPrisma();
  const stripeSubscription = await stripe!.subscriptions.retrieve(subscriptionId);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: {
        status: 'ACTIVE',
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      },
    });
  });

  logger.info({ subscriptionId }, 'Invoice paid, subscription updated');
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const prisma = getPrisma();
  const assignedBoosts = await prisma.boost.findMany({
    where: { subscriptionId, guildId: { not: null } },
    select: { guildId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: 'PAST_DUE' },
    });

    await tx.boost.updateMany({
      where: { subscriptionId, guildId: { not: null } },
      data: {
        guildId: null,
        assignedAt: null,
        unassignedAt: null,
      },
    });
  });

  await publishGuildPremiumInvalidation(assignedBoosts.map((boost) => boost.guildId));
  logger.warn({ subscriptionId }, 'Invoice payment failed, subscription marked PAST_DUE and boosts unassigned');
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const prisma = getPrisma();
  const status = mapStripeStatus(subscription.status);
  const boostCount = subscription.items.data[0]?.quantity ?? 0;
  const existingSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { boosts: true },
  });
  const affectedGuildIds = existingSubscription?.boosts
    .filter((boost) => boost.guildId !== null)
    .map((boost) => boost.guildId) ?? [];

  await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: {
        status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        boostCount,
      },
    });

    if (existingSubscription) {
      const currentCount = existingSubscription.boosts.length;
      if (boostCount > currentCount) {
        const toAdd = boostCount - currentCount;
        const boostData = Array.from({ length: toAdd }, () => ({ subscriptionId: subscription.id }));
        await tx.boost.createMany({ data: boostData });
        logger.info({ subscriptionId: subscription.id, added: toAdd }, 'Boost slots added');
      } else if (boostCount < currentCount) {
        await adjustBoostSlots(tx, subscription.id, boostCount, existingSubscription.boosts);
      }
    }
  });

  await publishGuildPremiumInvalidation(affectedGuildIds);
  logger.info({ subscriptionId: subscription.id, status, boostCount }, 'Subscription updated');
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const prisma = getPrisma();
  const assignedBoosts = await prisma.boost.findMany({
    where: { subscriptionId: subscription.id, guildId: { not: null } },
    select: { guildId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.subscription.updateMany({
      where: { stripeSubscriptionId: subscription.id },
      data: { status: 'CANCELED' },
    });

    await tx.boost.updateMany({
      where: { subscriptionId: subscription.id, guildId: { not: null } },
      data: {
        guildId: null,
        assignedAt: null,
        unassignedAt: new Date(),
      },
    });
  });

  await publishGuildPremiumInvalidation(assignedBoosts.map((boost) => boost.guildId));
  logger.info({ subscriptionId: subscription.id }, 'Subscription deleted, all boosts unassigned');
}

async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const prisma = getPrisma();
  let subscriptionId: string | null = null;

  // 1. charge → invoice → subscription の経路で取得を試みる
  const invoiceId = charge.invoice as string | null;
  if (invoiceId) {
    const invoice = await stripe!.invoices.retrieve(invoiceId);
    subscriptionId = invoice.subscription as string | null;
  }

  // 2. invoice 経由で取得できない場合、charge.customer から DB を検索
  if (!subscriptionId) {
    const customerId = charge.customer as string | null;
    if (!customerId) {
      logger.warn({ chargeId: charge.id }, 'Refunded charge has no invoice and no customer, skipping');
      return;
    }

    const dbSubscription = await prisma.subscription.findFirst({
      where: {
        stripeCustomerId: customerId,
        status: { in: ['ACTIVE', 'PAST_DUE'] },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!dbSubscription) {
      logger.warn({ chargeId: charge.id, customerId }, 'No active subscription found for customer, skipping');
      return;
    }

    subscriptionId = dbSubscription.stripeSubscriptionId;
    logger.info({ chargeId: charge.id, customerId, subscriptionId }, 'Found subscription via customer ID fallback');
  }

  // 全額返金かどうか判定
  const isFullRefund = charge.amount_refunded >= charge.amount;
  const sid = subscriptionId;

  if (isFullRefund) {
    const assignedBoosts = await prisma.boost.findMany({
      where: { subscriptionId: sid, guildId: { not: null } },
      select: { guildId: true },
    });

    // Stripe 側のサブスクリプションキャンセル（存在する場合）
    try {
      const stripeSubscription = await stripe!.subscriptions.retrieve(sid);
      if (stripeSubscription.status !== 'canceled') {
        await stripe!.subscriptions.cancel(sid);
        logger.info({ subscriptionId: sid }, 'Stripe subscription canceled due to full refund');
      }
    } catch (err) {
      // Stripe 上にサブスクリプションが存在しない場合（手動 DB 登録の場合）はスキップ
      logger.warn({ err, subscriptionId: sid }, 'Could not cancel Stripe subscription (may not exist in Stripe)');
    }

    await prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { stripeSubscriptionId: sid },
        data: { status: 'CANCELED' },
      });

      await tx.boost.updateMany({
        where: { subscriptionId: sid, guildId: { not: null } },
        data: {
          guildId: null,
          assignedAt: null,
          unassignedAt: new Date(),
        },
      });

      await tx.boost.deleteMany({
        where: { subscriptionId: sid },
      });
    });

    await publishGuildPremiumInvalidation(assignedBoosts.map((boost) => boost.guildId));
    logger.info({ subscriptionId: sid, chargeId: charge.id }, 'Full refund processed: subscription canceled, all boosts revoked and deleted');
  } else {
    logger.info(
      { subscriptionId: sid, chargeId: charge.id, amountRefunded: charge.amount_refunded, totalAmount: charge.amount },
      'Partial refund detected, no automatic boost changes applied',
    );
  }
}