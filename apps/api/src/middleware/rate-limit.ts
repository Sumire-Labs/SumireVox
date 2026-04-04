import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import crypto from 'node:crypto';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

interface RateLimitOptions {
  max: number;
  windowSeconds: number;
  keyPrefix: string;
}

const ANON_RATE_LIMIT_COOKIE = 'anon_rate_limit_id';
const ANON_RATE_LIMIT_COOKIE_MAX_AGE = 60 * 60;

function getRateLimitIdentifier(c: Parameters<MiddlewareHandler>[0]): string {
  const session = c.get('session');
  if (session?.userId) {
    return session.userId;
  }

  let anonId = getCookie(c, ANON_RATE_LIMIT_COOKIE);
  if (!anonId) {
    anonId = crypto.randomUUID();
    setCookie(c, ANON_RATE_LIMIT_COOKIE, anonId, {
      httpOnly: true,
      sameSite: 'Lax',
      secure: new URL(c.req.url).protocol === 'https:',
      maxAge: ANON_RATE_LIMIT_COOKIE_MAX_AGE,
      path: '/',
    });
  }

  return `anon:${anonId}`;
}

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const { max, windowSeconds, keyPrefix } = options;

  return async (c, next) => {
    const identifier = getRateLimitIdentifier(c);
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
