import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { getUserBoosts, assignBoost, unassignBoost } from '../services/boost-service.js';
import { createCheckoutSession, cancelSubscription, createBillingPortalSession } from '../services/stripe-service.js';
import { syncUserSubscriptionsIfStale } from '../services/stripe-sync-service.js';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { config } from '../infrastructure/config.js';

export const userRouter = new Hono();

userRouter.use('*', requireAuth);

/**
 * GET /api/user/boosts
 */
userRouter.get('/boosts', async (c) => {
  const session = c.get('session')!;
  await syncUserSubscriptionsIfStale(session.userId);
  const result = await getUserBoosts(session.userId);
  return c.json({ success: true, data: result });
});

/**
 * POST /api/user/boosts/checkout
 * body: { boostCount: number }
 */
userRouter.post('/boosts/checkout', async (c) => {
  if (!stripe) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Stripe is not configured' } },
      503,
    );
  }

  const session = c.get('session')!;
  const body = await c.req.json<{ boostCount?: number }>();
  const boostCount = body.boostCount ?? 1;

  if (!Number.isInteger(boostCount) || boostCount < 1 || boostCount > 10) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'ブースト数は1〜10の整数で指定してください。' },
      },
      400,
    );
  }

  const checkoutUrl = await createCheckoutSession(session.userId, boostCount);
  return c.json({ success: true, data: { url: checkoutUrl } });
});

/**
 * PUT /api/user/boosts/:boostId/assign
 * body: { guildId: string }
 */
userRouter.put('/boosts/:boostId/assign', async (c) => {
  const session = c.get('session')!;
  const boostId = c.req.param('boostId');
  const body = await c.req.json<{ guildId?: string }>();

  if (!body.guildId) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'guildId が必要です。' } },
      400,
    );
  }

  await assignBoost(session.userId, boostId, body.guildId);
  return c.json({ success: true, data: null });
});

/**
 * PUT /api/user/boosts/:boostId/unassign
 */
userRouter.put('/boosts/:boostId/unassign', async (c) => {
  const session = c.get('session')!;
  const boostId = c.req.param('boostId');

  await unassignBoost(session.userId, boostId);
  return c.json({ success: true, data: null });
});

/**
 * GET /api/user/subscription
 */
userRouter.get('/subscription', async (c) => {
  const session = c.get('session')!;
  const result = await getUserBoosts(session.userId);
  return c.json({ success: true, data: { subscription: result.subscription } });
});

/**
 * POST /api/user/billing-portal
 */
userRouter.post('/billing-portal', async (c) => {
  if (!stripe) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Stripe is not configured' } },
      503,
    );
  }

  const session = c.get('session')!;
  const prisma = getPrisma();

  const sub = await prisma.subscription.findFirst({
    where: { userId: session.userId },
    select: { stripeCustomerId: true },
  });

  if (!sub?.stripeCustomerId) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'サブスクリプションが見つかりません。' } },
      404,
    );
  }

  const url = await createBillingPortalSession(
    sub.stripeCustomerId,
    `${config.webDomain}/dashboard/boost`,
  );
  return c.json({ success: true, data: { url } });
});

/**
 * POST /api/user/subscription/cancel
 */
userRouter.post('/subscription/cancel', async (c) => {
  if (!stripe) {
    return c.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Stripe is not configured' } },
      503,
    );
  }

  const session = c.get('session')!;
  await cancelSubscription(session.userId);
  return c.json({ success: true, data: null });
});
