import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { validate } from '../middleware/validate.js';
import { getUserBoosts, assignBoost, unassignBoost, setGuildBoostCount, getGuildBoostInfo } from '../services/boost-service.js';
import { createCheckoutSession, cancelSubscription, createBillingPortalSession } from '../services/stripe-service.js';
import { syncUserSubscriptionsIfStale } from '../services/stripe-sync-service.js';
import { stripe } from '../infrastructure/stripe-client.js';
import { getPrisma } from '../infrastructure/database.js';
import { config } from '../infrastructure/config.js';
import { fetchUserGuilds } from '../services/discord-api.js';
import {
  getActiveBotInstances,
  getActiveInstanceCount,
  getGuildsWithBotStatus,
} from '../services/bot-instance-service.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';
import { AppError } from '../infrastructure/app-error.js';

const boostIdParamsSchema = z.object({ boostId: z.string().cuid() });
const checkoutBodySchema = z
  .object({ boostCount: z.number().int().min(1).max(10).default(1) })
  .strict();
const boostAssignBodySchema = z
  .object({
    guildId: z.string().min(1),
    count: z.number().int().min(0),
  })
  .strict();
const boostAssignByIdBodySchema = z.object({ guildId: z.string().min(1) }).strict();

const USER_GUILDS_CACHE_TTL = 60;
const userGuildsCacheKey = (userId: string) => `user:${userId}:all-guilds`;

async function getActiveBotGuildIds(userId: string, accessToken: string): Promise<string[]> {
  const cacheKey = userGuildsCacheKey(userId);
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
      const guilds = await fetchUserGuilds(accessToken);
      allGuilds = guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon }));
      try {
        await getRedisClient().set(cacheKey, JSON.stringify(allGuilds), 'EX', USER_GUILDS_CACHE_TTL);
      } catch (err) {
        logger.warn({ err }, 'Failed to write user all-guilds cache');
      }
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 401) {
        throw err;
      }
      logger.warn({ err }, 'Failed to fetch user guilds for guild boost info');
      return [];
    }
  }

  const botInstances = await getActiveBotInstances();
  const guildBotStatusMap = await getGuildsWithBotStatus(
    allGuilds.map((guild) => guild.id),
    botInstances,
  );

  return allGuilds
    .filter((guild) => guildBotStatusMap.get(guild.id) ?? false)
    .map((guild) => guild.id);
}

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
      if (err instanceof AppError && err.statusCode === 401) {
        return c.json(
          { success: false, error: { code: 'SESSION_EXPIRED', message: 'セッションの有効期限が切れました。再ログインしてください。' } },
          401,
        );
      }
      logger.error({ err }, 'Failed to fetch user guilds');
      return c.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'ギルド一覧の取得に失敗しました。' } },
        500,
      );
    }
  }

  const botInstances = await getActiveBotInstances();
  const guildBotStatusMap = await getGuildsWithBotStatus(
    allGuilds.map((guild) => guild.id),
    botInstances,
  );
  const result = allGuilds.filter((guild) => guildBotStatusMap.get(guild.id) ?? false);

  return c.json({ success: true, data: result });
});

/**
 * GET /api/user/boosts
 */
userRouter.get('/boosts', async (c) => {
  const session = c.get('session')!;
  await syncUserSubscriptionsIfStale(session.userId);
  const botGuildIds = await getActiveBotGuildIds(session.userId, session.accessToken);
  const [result, maxBoostsPerGuild, guildBoostInfo] = await Promise.all([
    getUserBoosts(session.userId),
    getActiveInstanceCount(),
    getGuildBoostInfo(session.userId, botGuildIds),
  ]);
  return c.json({ success: true, data: { ...result, maxBoostsPerGuild, guildBoostInfo } });
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
  const { boostCount } = await validate.body(c, checkoutBodySchema);
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
  const body = await validate.body(c, boostAssignBodySchema);

  const maxBoostsPerGuild = await getActiveInstanceCount();
  if (body.count > maxBoostsPerGuild) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: '1サーバーあたりの最大ブースト数を超えています。' } },
      400,
    );
  }

  await setGuildBoostCount(session.userId, body.guildId, body.count);
  await syncUserSubscriptionsIfStale(session.userId);
  const botGuildIds = await getActiveBotGuildIds(session.userId, session.accessToken);
  const [result, guildBoostInfo] = await Promise.all([
    getUserBoosts(session.userId),
    getGuildBoostInfo(session.userId, botGuildIds),
  ]);
  return c.json({ success: true, data: { ...result, maxBoostsPerGuild, guildBoostInfo } });
});

/**
 * PUT /api/user/boosts/:boostId/assign
 * body: { guildId: string }
 */
userRouter.put('/boosts/:boostId/assign', async (c) => {
  const session = c.get('session')!;
  const { boostId } = await validate.params(c, boostIdParamsSchema);
  const { guildId } = await validate.body(c, boostAssignByIdBodySchema);
  await assignBoost(session.userId, boostId, guildId);
  return c.json({ success: true, data: null });
});

/**
 * PUT /api/user/boosts/:boostId/unassign
 */
userRouter.put('/boosts/:boostId/unassign', async (c) => {
  const session = c.get('session')!;
  const { boostId } = await validate.params(c, boostIdParamsSchema);

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
