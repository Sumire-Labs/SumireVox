import type { MiddlewareHandler } from 'hono';
import { hasManageGuildPermission } from '../services/discord-api.js';

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

  const hasPermission = await hasManageGuildPermission(session.accessToken, guildId);
  if (!hasPermission) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'このサーバーの管理権限がありません。' } },
      403,
    );
  }

  await next();
};
