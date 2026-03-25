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

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    },
  });

  logger.info({ subscriptionId: subscription.id, status }, 'Subscription updated');
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
