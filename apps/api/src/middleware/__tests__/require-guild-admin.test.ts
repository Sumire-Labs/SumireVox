import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../infrastructure/app-error.js';

const { hasManageGuildPermissionMock, getUserGuildsMock, redisMock } = vi.hoisted(() => ({
  hasManageGuildPermissionMock: vi.fn(),
  getUserGuildsMock: vi.fn(),
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../services/discord-api.js', () => ({
  hasManageGuildPermission: hasManageGuildPermissionMock,
}));

vi.mock('../../services/user-guild-service.js', () => ({
  getUserGuilds: getUserGuildsMock,
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: () => redisMock,
}));

import { requireGuildAdmin } from '../require-guild-admin.js';
import { errorHandler } from '../error-handler.js';

function buildApp(): Hono {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('/guilds/:guildId/settings', async (c, next) => {
    c.set('session', {
      userId: 'user1',
      username: 'u',
      discriminator: '0',
      avatar: null,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: Date.now() + 60_000,
    });
    await next();
  });
  app.use('/guilds/:guildId/settings', requireGuildAdmin);
  app.get('/guilds/:guildId/settings', (c) => c.json({ success: true, data: null }));
  return app;
}

describe('requireGuildAdmin', () => {
  beforeEach(() => {
    hasManageGuildPermissionMock.mockReset();
    getUserGuildsMock.mockReset().mockResolvedValue([]);
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
  });

  it('maps Discord-expiry AppError (401) to SESSION_EXPIRED', async () => {
    hasManageGuildPermissionMock.mockRejectedValue(
      new AppError('DISCORD_TOKEN_EXPIRED', 'Discord access token has expired. Please re-login.', 401),
    );

    const res = await buildApp().request('/guilds/123/settings');

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: 'SESSION_EXPIRED', message: 'セッションの有効期限が切れました。再ログインしてください。' },
    });
  });

  it('propagates non-401 errors unchanged', async () => {
    const boom = new AppError('DISCORD_API_ERROR', 'Discord API error: 500', 500);
    hasManageGuildPermissionMock.mockRejectedValue(boom);

    const res = await buildApp().request('/guilds/123/settings');

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      success: false,
      error: { code: 'DISCORD_API_ERROR', message: 'Discord API error: 500' },
    });
  });
});
