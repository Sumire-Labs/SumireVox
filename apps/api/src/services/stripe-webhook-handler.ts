import Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { logger } from '../infrastructure/logger.js';
import { adjustBoostSlots } from './adjust-boost-slots.js';
import { publishGuildPremiumInvalidation } from './premium-cache-sync.js';
import { mapStripeStatus } from './stripe-utils.js';

/**
 * Stripe Webhook イベントを処理する（署名検証済みイベントを受け取る）
 */
export async function handleStripeWebhook(event: Stripe.Event): Promise<void> {
  logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');

  // 冪等性チェック: 既処理イベントは早期リターン
  const prisma = getPrisma();
  const existingEvent = await prisma.stripeEvent.findUnique({ where: { id: event.id } });
  if (existingEvent) {
    logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook already processed, skipping');
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice, event.id);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, event.id);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.id);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event.id);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge, event.id);
        break;
      default:
        logger.debug({ type: event.type }, 'Unhandled webhook event type');
    }
  } catch (error) {
    // 競合状態: 別リクエストが同じイベントを先に処理済みにした場合
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info({ eventId: event.id, type: event.type }, 'Stripe webhook processed concurrently, skipping');
      return;
    }
    throw error;
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string): Promise<void> {
  const userId = session.metadata?.userId;
  const boostCount = parseInt(session.metadata?.boostCount ?? '0', 10);
  const subscriptionId = session.subscription as string;
  const customerId = session.customer as string;

  if (!userId || !subscriptionId || !customerId) {
    logger.warn({ sessionId: session.id }, 'Checkout completed but missing metadata');
    return;
  }

  const prisma = getPrisma();
  // stripe is guaranteed non-null here: handleStripeWebhook guards at entry
  const stripeSubscription = await stripe!.subscriptions.retrieve(subscriptionId);

  await prisma.$transaction(async (tx) => {
    await tx.stripeEvent.create({ data: { id: eventId, type: 'checkout.session.completed' } });

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

async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const prisma = getPrisma();
  const stripeSubscription = await stripe!.subscriptions.retrieve(subscriptionId);

  await prisma.$transaction(async (tx) => {
    await tx.stripeEvent.create({ data: { id: eventId, type: 'invoice.paid' } });

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

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const prisma = getPrisma();
  const assignedBoosts = await prisma.boost.findMany({
    where: { subscriptionId, guildId: { not: null } },
    select: { guildId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.stripeEvent.create({ data: { id: eventId, type: 'invoice.payment_failed' } });

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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, eventId: string): Promise<void> {
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
    await tx.stripeEvent.create({ data: { id: eventId, type: 'customer.subscription.updated' } });

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

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, eventId: string): Promise<void> {
  const prisma = getPrisma();
  const assignedBoosts = await prisma.boost.findMany({
    where: { subscriptionId: subscription.id, guildId: { not: null } },
    select: { guildId: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.stripeEvent.create({ data: { id: eventId, type: 'customer.subscription.deleted' } });

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

async function handleChargeRefunded(charge: Stripe.Charge, eventId: string): Promise<void> {
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
      await tx.stripeEvent.create({ data: { id: eventId, type: 'charge.refunded' } });

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
    await prisma.$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { id: eventId, type: 'charge.refunded' } });
    });

    logger.info(
      { subscriptionId: sid, chargeId: charge.id, amountRefunded: charge.amount_refunded, totalAmount: charge.amount },
      'Partial refund detected, no automatic boost changes applied',
    );
  }
}
