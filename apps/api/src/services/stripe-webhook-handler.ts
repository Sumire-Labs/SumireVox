import Stripe from 'stripe';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { logger } from '../infrastructure/logger.js';

/**
 * Stripe Webhook イベントを処理する
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): Promise<void> {
  if (!stripe) {
    throw new Error('Stripe is not configured');
  }
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    logger.error({ err: error }, 'Webhook signature verification failed');
    throw error;
  }

  logger.info({ type: event.type, id: event.id }, 'Stripe webhook received');

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
  // stripe is guaranteed non-null here: handleStripeWebhook guards at entry
  const subscription = await stripe!.subscriptions.retrieve(subscriptionId);

  await prisma.subscription.create({
    data: {
      userId,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      boostCount,
    },
  });

  const boostData = Array.from({ length: boostCount }, () => ({
    subscriptionId,
  }));
  await prisma.boost.createMany({ data: boostData });

  logger.info({ userId, subscriptionId, boostCount }, 'Subscription created from checkout');
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const prisma = getPrisma();
  const subscription = await stripe!.subscriptions.retrieve(subscriptionId);

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: {
      status: 'ACTIVE',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info({ subscriptionId }, 'Invoice paid, subscription updated');
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId = invoice.subscription as string;
  if (!subscriptionId) return;

  const prisma = getPrisma();

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscriptionId },
    data: { status: 'PAST_DUE' },
  });

  logger.warn({ subscriptionId }, 'Invoice payment failed, subscription marked PAST_DUE');
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const prisma = getPrisma();
  const status = mapStripeStatus(subscription.status);
  const boostCount = subscription.items.data[0]?.quantity ?? 0;

  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    include: { boosts: true },
  });

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      boostCount,
    },
  });

  // ブースト枠数が変化した場合に DB レコードを増減
  if (existing) {
    const currentCount = existing.boosts.length;
    if (boostCount > currentCount) {
      const toAdd = boostCount - currentCount;
      const boostData = Array.from({ length: toAdd }, () => ({ subscriptionId: subscription.id }));
      await prisma.boost.createMany({ data: boostData });
      logger.info({ subscriptionId: subscription.id, added: toAdd }, 'Boost slots added');
    } else if (boostCount < currentCount) {
      const toRemove = currentCount - boostCount;
      const unassigned = existing.boosts.filter((b) => !b.guildId).slice(0, toRemove);
      for (const boost of unassigned) {
        await prisma.boost.delete({ where: { id: boost.id } });
      }
      if (unassigned.length < toRemove) {
        logger.warn(
          { subscriptionId: subscription.id, needed: toRemove, removed: unassigned.length },
          'Could not remove all excess boost slots — some are still assigned',
        );
      }
    }
  }

  logger.info({ subscriptionId: subscription.id, status, boostCount }, 'Subscription updated');
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const prisma = getPrisma();

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: { status: 'CANCELED' },
  });

  await prisma.boost.updateMany({
    where: { subscriptionId: subscription.id, guildId: { not: null } },
    data: {
      guildId: null,
      assignedAt: null,
      unassignedAt: new Date(),
    },
  });

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

  if (isFullRefund) {
    // Stripe 側のサブスクリプションキャンセル（存在する場合）
    try {
      const stripeSubscription = await stripe!.subscriptions.retrieve(subscriptionId);
      if (stripeSubscription.status !== 'canceled') {
        await stripe!.subscriptions.cancel(subscriptionId);
        logger.info({ subscriptionId }, 'Stripe subscription canceled due to full refund');
      }
    } catch (err) {
      // Stripe 上にサブスクリプションが存在しない場合（手動 DB 登録の場合）はスキップ
      logger.warn({ err, subscriptionId }, 'Could not cancel Stripe subscription (may not exist in Stripe)');
    }

    // DB のサブスクリプションを CANCELED に更新
    await prisma.subscription.updateMany({
      where: { stripeSubscriptionId: subscriptionId },
      data: { status: 'CANCELED' },
    });

    // 割り当て済みブーストをすべて解除
    await prisma.boost.updateMany({
      where: { subscriptionId, guildId: { not: null } },
      data: {
        guildId: null,
        assignedAt: null,
        unassignedAt: new Date(),
      },
    });

    // 全ブースト削除
    await prisma.boost.deleteMany({
      where: { subscriptionId },
    });

    logger.info({ subscriptionId, chargeId: charge.id }, 'Full refund processed: subscription canceled, all boosts revoked and deleted');
  } else {
    logger.info(
      { subscriptionId, chargeId: charge.id, amountRefunded: charge.amount_refunded, totalAmount: charge.amount },
      'Partial refund detected, no automatic boost changes applied',
    );
  }
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
