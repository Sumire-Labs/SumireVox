import type { MiddlewareHandler } from 'hono';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

interface RateLimitOptions {
  max: number;
  windowSeconds: number;
  keyPrefix: string;
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { max, windowSeconds, keyPrefix } = options;

  return async (c, next) => {
    const session = c.get('session');
    const identifier =
      session?.userId ?? (c.req.header('x-forwarded-for') ?? 'unknown');
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `ratelimit:${identifier}:${keyPrefix}:${window}`;

    try {
      const redis = getRedisClient();
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, windowSeconds);
      }

      if (count > max) {
        const windowEnd = (window + 1) * windowSeconds;
        const retryAfter = Math.max(1, windowEnd - Math.floor(Date.now() / 1000));
        c.header('Retry-After', String(retryAfter));
        return c.json(
          {
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message:
                'リクエスト数の上限に達しました。しばらく待ってから再度お試しください。',
            },
          },
          429,
        );
      }
    } catch (err) {
      logger.error({ err }, 'Rate limit Redis error, skipping');
    }

    await next();
  };
}
