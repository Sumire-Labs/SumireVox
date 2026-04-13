import type { MiddlewareHandler } from 'hono';
import { getRedisClient, isRedisReady } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

interface RateLimitOptions {
  max: number;
  windowSeconds: number;
  keyPrefix: string;
}

const REDIS_UNAVAILABLE_RESPONSE = {
  success: false,
  error: {
    code: 'SERVICE_UNAVAILABLE',
    message: 'サービスが一時的に利用できません。しばらくしてから再度お試しください。',
  },
} as const;

function getRateLimitIdentifier(c: Parameters<MiddlewareHandler>[0]): string {
  const session = c.get('session');
  if (session?.userId) {
    return `user:${session.userId}`;
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) {
    return `ip:${realIp.trim() || 'unknown'}`;
  }

  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    const forwardedIps = forwardedFor
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean);
    const trustedIp = forwardedIps.at(-1);
    return `ip:${trustedIp || 'unknown'}`;
  }

  return 'ip:unknown';
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { max, windowSeconds, keyPrefix } = options;

  return async (c, next) => {
    const identifier = getRateLimitIdentifier(c);
    const window = Math.floor(Date.now() / 1000 / windowSeconds);
    const key = `ratelimit:${identifier}:${keyPrefix}:${window}`;

    if (!isRedisReady()) {
      c.header('Retry-After', '30');
      return c.json(REDIS_UNAVAILABLE_RESPONSE, 503);
    }

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
      logger.error({ err, key }, 'Rate limit Redis error');
      c.header('Retry-After', '30');
      return c.json(REDIS_UNAVAILABLE_RESPONSE, 503);
    }

    await next();
  };
}
