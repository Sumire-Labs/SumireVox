import type { MiddlewareHandler } from 'hono';
import { config } from '../infrastructure/config.js';

export const requireBotAdmin: MiddlewareHandler = async (c, next) => {
  const session = c.get('session');
  if (!session || !config.botAdminUserIds.includes(session.userId)) {
    return c.json(
      {
        success: false,
        error: { code: 'FORBIDDEN', message: '権限がありません。' },
      },
      403,
    );
  }
  await next();
};
