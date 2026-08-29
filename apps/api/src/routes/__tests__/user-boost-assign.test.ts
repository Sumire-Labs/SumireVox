import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock, boostServiceMock, fetchUserGuildsMock } = vi.hoisted(() => ({
  redisMock: {
    incr: vi.fn(),
    expire: vi.fn(),
  },
  boostServiceMock: {
    getUserBoosts: vi.fn(),
    assignBoost: vi.fn(),
    unassignBoost: vi.fn(),
    setGuildBoostCount: vi.fn(),
    getGuildBoostInfo: vi.fn(),
  },
  fetchUserGuildsMock: vi.fn(),
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: { webDomain: 'http://localhost:5173' },
}));

vi.mock('../../infrastructure/redis.js', () => ({
  isRedisReady: () => true,
  getRedisClient: () => redisMock,
}));

vi.mock('../../services/boost-service.js', () => boostServiceMock);
vi.mock('../../services/discord-api.js', () => ({ fetchUserGuilds: fetchUserGuildsMock }));

import { errorHandler } from '../../middleware/error-handler.js';
import { userRouter } from '../user.js';

function buildApp(): Hono {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('/api/user/*', async (c, next) => {
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
  app.route('/api/user', userRouter);
  return app;
}

describe('POST /api/user/boosts/assign guildId validation', () => {
  beforeEach(() => {
    redisMock.incr.mockReset();
    redisMock.expire.mockReset();
    redisMock.incr.mockResolvedValue(1);
    redisMock.expire.mockResolvedValue(1);
    boostServiceMock.setGuildBoostCount.mockReset();
    boostServiceMock.getUserBoosts.mockReset();
    boostServiceMock.getGuildBoostInfo.mockReset();
    fetchUserGuildsMock.mockReset();
  });

  it('rejects a non-Snowflake guildId with VALIDATION_ERROR before any downstream service call', async () => {
    const res = await buildApp().request('/api/user/boosts/assign', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guildId: 'not-a-snowflake', count: 1 }),
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');

    // 検証が先に失敗するため、下流のサービス・Discord API は呼ばれない
    expect(boostServiceMock.setGuildBoostCount).not.toHaveBeenCalled();
    expect(boostServiceMock.getUserBoosts).not.toHaveBeenCalled();
    expect(boostServiceMock.getGuildBoostInfo).not.toHaveBeenCalled();
    expect(fetchUserGuildsMock).not.toHaveBeenCalled();
  });
});
