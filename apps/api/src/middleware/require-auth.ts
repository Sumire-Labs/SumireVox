import type { MiddlewareHandler } from 'hono';

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const session = c.get('session');
  if (!session) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '認証が必要です。' },
      },
      401,
    );
  }
  await next();
};
