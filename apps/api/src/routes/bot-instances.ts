import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { getAllBotInstances } from '../services/bot-instance-service.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

export const botInstancesRouter = new Hono();

botInstancesRouter.use('*', requireAuth);

const BOT_INSTANCES_CACHE_KEY = 'bot:instances:all';
const BOT_INSTANCES_CACHE_TTL = 300;

/**
 * GET /api/bot-instances
 * Bot インスタンス一覧（認証済みユーザー向け）
 */
botInstancesRouter.get('/', async (c) => {
  const redis = getRedisClient();

  try {
    const cached = await redis.get(BOT_INSTANCES_CACHE_KEY);
    if (cached) {
      return c.json({ success: true, data: JSON.parse(cached) as unknown });
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to read bot instances cache');
  }

  const instances = await getAllBotInstances();
  const result = {
    instances: instances.map((i) => ({
      id: i.instanceId,
      instanceNumber: i.instanceId,
      name: i.name,
      botUserId: i.botUserId,
      isActive: i.isActive,
    })),
  };

  try {
    await redis.set(BOT_INSTANCES_CACHE_KEY, JSON.stringify(result), 'EX', BOT_INSTANCES_CACHE_TTL);
  } catch (err) {
    logger.warn({ err }, 'Failed to write bot instances cache');
  }

  return c.json({ success: true, data: result });
});
