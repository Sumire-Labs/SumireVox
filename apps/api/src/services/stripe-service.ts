import Stripe from 'stripe';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { AppError } from '../infrastructure/app-error.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

/**
 * Stripe Checkout Session を作成する
 */
export async function createCheckoutSession(
  userId: string,
  boostCount: number,
): Promise<string> {
  if (!stripe) {
    throw new AppError('INTERNAL_ERROR', 'Stripe is not configured', 503);
  }
  const prisma = getPrisma();

  const existingSub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: {
        in: ['ACTIVE', 'PAST_DUE', 'INCOMPLETE'],
      },
    },
    select: { stripeCustomerId: true, stripeSubscriptionId: true, status: true },
  });

  if (existingSub) {
    throw new AppError(
      'VALIDATION_ERROR',
      '既存のサブスクリプションがあります。ブースト数の変更は Billing Portal から行ってください。',
      400,
    );
  }

  const existingCustomer = await prisma.subscription.findFirst({
    where: { userId },
    select: { stripeCustomerId: true },
  });

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    allow_promotion_codes: true,
    line_items: [
      {
        price: config.stripePriceId,
        quantity: boostCount,
      },
    ],
    success_url: `${config.webDomain}/dashboard/boost?success=true`,
    cancel_url: `${config.webDomain}/dashboard/boost?canceled=true`,
    metadata: {
      userId,
      boostCount: boostCount.toString(),
    },
    subscription_data: {
      metadata: {
        userId,
        boostCount: boostCount.toString(),
      },
    },
  };

  if (existingCustomer?.stripeCustomerId) {
    sessionParams.customer = existingCustomer.stripeCustomerId;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error('Checkout session URL is null');
  }

  logger.info({ userId, boostCount, sessionId: session.id }, 'Checkout session created');
  return session.url;
}

/**
 * Stripe カスタマーポータルセッションを作成する
 */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  if (!stripe) {
    throw new AppError('INTERNAL_ERROR', 'Stripe is not configured', 503);
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * サブスクリプションを解約する（期末解約）
 */
export async function cancelSubscription(userId: string): Promise<void> {
  if (!stripe) {
    throw new AppError('INTERNAL_ERROR', 'Stripe is not configured', 503);
  }
  const prisma = getPrisma();

  const subs = await prisma.subscription.findMany({
    where: { userId, status: 'ACTIVE' },
    select: { stripeSubscriptionId: true },
  });

  if (subs.length === 0) {
    throw new AppError('NOT_FOUND', 'アクティブなサブスクリプションが見つかりません。', 404);
  }

  await Promise.all(
    subs.map((sub) =>
      stripe!.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      }),
    ),
  );

  logger.info(
    { userId, subscriptionIds: subs.map((sub) => sub.stripeSubscriptionId) },
    'Subscriptions set to cancel at period end',
  );
}
