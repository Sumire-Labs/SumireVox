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
    where: { userId },
    select: { stripeCustomerId: true },
  });

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
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

  if (existingSub?.stripeCustomerId) {
    sessionParams.customer = existingSub.stripeCustomerId;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error('Checkout session URL is null');
  }

  logger.info({ userId, boostCount, sessionId: session.id }, 'Checkout session created');
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

  const sub = await prisma.subscription.findFirst({
    where: { userId, status: 'ACTIVE' },
  });

  if (!sub) {
    throw new AppError('NOT_FOUND', 'アクティブなサブスクリプションが見つかりません。', 404);
  }

  await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  logger.info(
    { userId, subscriptionId: sub.stripeSubscriptionId },
    'Subscription set to cancel at period end',
  );
}
