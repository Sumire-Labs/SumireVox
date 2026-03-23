import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { getUserBoosts, assignBoost, unassignBoost } from '../services/boost-service.js';
import { createCheckoutSession, cancelSubscription } from '../services/stripe-service.js';

export const userRouter = new Hono();

userRouter.use('*', requireAuth);

/**
 * GET /api/user/boosts
 */
userRouter.get('/boosts', async (c) => {
  const session = c.get('session')!;
  const result = await getUserBoosts(session.userId);
  return c.json({ success: true, data: result });
});

/**
 * POST /api/user/boosts/checkout
 * body: { boostCount: number }
 */
userRouter.post('/boosts/checkout', async (c) => {
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
 * POST /api/user/subscription/cancel
 */
userRouter.post('/subscription/cancel', async (c) => {
  const session = c.get('session')!;
  await cancelSubscription(session.userId);
  return c.json({ success: true, data: null });
});
