import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { getUserBoosts, assignBoost, unassignBoost, setGuildBoostCount } from '../services/boost-service.js';
import { createCheckoutSession, cancelSubscription, createBillingPortalSession } from '../services/stripe-service.js';
import { syncUserSubscriptionsIfStale } from '../services/stripe-sync-service.js';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { config } from '../infrastructure/config.js';
import { fetchUserGuilds } from '../services/discord-api.js';
import { getActiveBotInstances, isBotInGuild } from '../services/bot-instance-service.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

const USER_GUILDS_CACHE_TTL = 60;
const userGuildsCacheKey = (userId: string) => `user:${userId}:all-guilds`;

export const userRouter = new Hono();

userRouter.use('*', requireAuth);

/**
 * GET /api/user/guilds
 * Bot が参加しているサーバーの一覧（管理権限チェックなし）
 */
userRouter.get('/guilds', async (c) => {
  const session = c.get('session')!;
  const cacheKey = userGuildsCacheKey(session.userId);

  let allGuilds: Array<{ id: string; name: string; icon: string | null }> | null = null;

  try {
    const cached = await getRedisClient().get(cacheKey);
    if (cached) {
      allGuilds = JSON.parse(cached) as Array<{ id: string; name: string; icon: string | null }>;
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to read user all-guilds cache');
  }

  if (!allGuilds) {
    try {
      const guilds = await fetchUserGuilds(session.accessToken);
      allGuilds = guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
      try {
        await getRedisClient().set(cacheKey, JSON.stringify(allGuilds), 'EX', USER_GUILDS_CACHE_TTL);
      } catch (err) {
        logger.warn({ err }, 'Failed to write user all-guilds cache');
      }
    } catch (err) {
      logger.error({ err }, 'Failed to fetch user guilds');
      return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'ギルド一覧の取得に失敗しました。' } },
        500,
      );
    }
  }

  const botInstances = await getActiveBotInstances();
  const result: Array<{ id: string; name: string; icon: string | null }> = [];
  for (const guild of allGuilds) {
    for (const instance of botInstances) {
      if (await isBotInGuild(instance.instanceId, guild.id)) {
        result.push(guild);
        break;
      }
    }
  }

  return c.json({ success: true, data: result });
});

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
 * POST /api/user/boosts/assign
 * body: { guildId: string, count: number }
 * ギルドへのブースト割り当て数を設定する（増減を自動処理）
 */
userRouter.post('/boosts/assign', async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json<{ guildId?: string; count?: number }>();

  if (!body.guildId) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'guildId が必要です。' } },
      400,
    );
  }

  if (typeof body.count !== 'number' || !Number.isInteger(body.count) || body.count < 0) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'count は0以上の整数で指定してください。' } },
      400,
    );
  }

  await setGuildBoostCount(session.userId, body.guildId, body.count);
  await syncUserSubscriptionsIfStale(session.userId);
  const result = await getUserBoosts(session.userId);
  return c.json({ success: true, data: result });
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
