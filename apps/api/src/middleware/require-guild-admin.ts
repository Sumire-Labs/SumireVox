import type { MiddlewareHandler } from 'hono';
import { hasManageGuildPermission } from '../services/discord-api.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

const GUILD_ADMIN_CACHE_TTL = 300; // 5分

export const guildAdminCacheKey = (userId: string, guildId: string) =>
  `user:${userId}:guild:${guildId}:admin`;

export const requireGuildAdmin: MiddlewareHandler = async (c, next) => {
  const session = c.get('session');
  if (!session) {
    return c.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: '認証が必要です。' } },
      401,
    );
  }

  const guildId = c.req.param('guildId');
  if (!guildId) {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'guildId が必要です。' } },
      400,
    );
  }

  const cacheKey = guildAdminCacheKey(session.userId, guildId);

  try {
    const cached = await getRedisClient().get(cacheKey);
    if (cached !== null) {
      if (cached === 'false') {
        return c.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'このサーバーの管理権限がありません。' } },
          403,
        );
      }
      await next();
      return;
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to read guild admin cache');
  }

  const hasPermission = await hasManageGuildPermission(session.accessToken, guildId);

  try {
    await getRedisClient().set(cacheKey, String(hasPermission), 'EX', GUILD_ADMIN_CACHE_TTL);
  } catch (err) {
    logger.warn({ err }, 'Failed to write guild admin cache');
  }

  if (!hasPermission) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'このサーバーの管理権限がありません。' } },
      403,
    );
  }

  await next();
};
