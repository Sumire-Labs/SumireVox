import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  configMock,
  redisMock,
  stripeMock,
  stripeState,
  syncMock,
  staleSyncMock,
  boostServiceMock,
  botInstanceServiceMock,
  fetchUserGuildsMock,
} = vi.hoisted(() => ({
  configMock: { webDomain: 'http://localhost:5173' },
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
  },
  stripeMock: {},
  stripeState: { configured: true },
  syncMock: vi.fn(),
  staleSyncMock: vi.fn(),
  boostServiceMock: {
    getUserBoosts: vi.fn(),
    assignBoost: vi.fn(),
    unassignBoost: vi.fn(),
    setGuildBoostCount: vi.fn(),
    getGuildBoostInfo: vi.fn(),
  },
  botInstanceServiceMock: {
    getActiveBotInstances: vi.fn(),
    getMaxBoostsPerGuild: vi.fn(),
    getGuildsWithBotStatus: vi.fn(),
  },
  fetchUserGuildsMock: vi.fn(),
}));

vi.mock('../../infrastructure/config.js', () => ({ config: configMock }));
vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: () => redisMock,
  isRedisReady: () => true,
}));
vi.mock('../../infrastructure/stripe-client.js', () => ({
  get stripe() {
    return stripeState.configured ? stripeMock : null;
  },
}));
vi.mock('../../infrastructure/database.js', () => ({ getPrisma: vi.fn() }));
vi.mock('../../infrastructure/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../services/stripe-service.js', () => ({
  createCheckoutSession: vi.fn(),
  cancelSubscription: vi.fn(),
  createBillingPortalSession: vi.fn(),
}));
vi.mock('../../services/stripe-sync-service.js', () => ({
  syncUserSubscriptions: syncMock,
  syncUserSubscriptionsIfStale: staleSyncMock,
}));
vi.mock('../../services/boost-service.js', () => boostServiceMock);
vi.mock('../../services/bot-instance-service.js', () => botInstanceServiceMock);
vi.mock('../../services/discord-api.js', () => ({ fetchUserGuilds: fetchUserGuildsMock }));

import { errorHandler } from '../../middleware/error-handler.js';
import { userRouter } from '../user.js';

function createBoostData() {
  return {
    boosts: [],
    subscription: null,
    totalBoosts: 0,
    usedBoosts: 0,
    cooldownBoosts: 0,
    availableBoosts: 0,
    maxBoostsPerGuild: 0,
    allocations: [],
    cooldowns: [],
  };
}

function buildApp(authenticated = true): Hono {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('/api/user/*', async (c, next) => {
    c.set(
      'session',
      authenticated
        ? {
            userId: 'user1',
            username: 'u',
            discriminator: '0',
            avatar: null,
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
            tokenExpiresAt: Date.now() + 60_000,
          }
        : null,
    );
    await next();
  });
  app.route('/api/user', userRouter);
  return app;
}

describe('POST /api/user/subscription/sync', () => {
  beforeEach(() => {
    stripeState.configured = true;
    redisMock.get.mockReset().mockResolvedValue(null);
    redisMock.set.mockReset().mockResolvedValue('OK');
    redisMock.incr.mockReset().mockResolvedValue(1);
    redisMock.expire.mockReset().mockResolvedValue(1);
    syncMock.mockReset().mockResolvedValue(undefined);
    staleSyncMock.mockReset();
    boostServiceMock.getUserBoosts.mockReset().mockResolvedValue(createBoostData());
    boostServiceMock.getGuildBoostInfo.mockReset().mockResolvedValue([]);
    botInstanceServiceMock.getActiveBotInstances.mockReset().mockResolvedValue([]);
    botInstanceServiceMock.getMaxBoostsPerGuild.mockReset().mockResolvedValue(2);
    botInstanceServiceMock.getGuildsWithBotStatus.mockReset().mockResolvedValue(new Map());
    fetchUserGuildsMock.mockReset().mockResolvedValue([]);
  });

  it('同期対象をセッションの userId に固定し、TTL なしの同期結果を返す', async () => {
    const response = await buildApp().request('/api/user/subscription/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'other-user',
        stripeCustomerId: 'cus-other',
        stripeSubscriptionId: 'sub-other',
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { ...createBoostData(), maxBoostsPerGuild: 2, guildBoostInfo: [] },
    });
    expect(syncMock).toHaveBeenCalledWith('user1');
    expect(staleSyncMock).not.toHaveBeenCalled();
    expect(redisMock.incr).toHaveBeenCalledWith(expect.stringMatching(/^ratelimit:user:user1:subscription-sync:/));
    expect(redisMock.expire).toHaveBeenCalledWith(expect.stringMatching(/^ratelimit:user:user1:subscription-sync:/), 60);
  });

  it('未認証ユーザーを拒否する', async () => {
    const response = await buildApp(false).request('/api/user/subscription/sync', { method: 'POST' });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: 'UNAUTHORIZED', message: '認証が必要です。' },
    });
    expect(syncMock).not.toHaveBeenCalled();
    expect(redisMock.incr).not.toHaveBeenCalled();
  });

  it('Stripe 未設定時は同期せずエラーを返す', async () => {
    stripeState.configured = false;

    const response = await buildApp().request('/api/user/subscription/sync', { method: 'POST' });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Stripe is not configured' },
    });
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('Stripe 同期失敗時は内部エラーのエンベロープを返す', async () => {
    syncMock.mockRejectedValue(new Error('stripe request failed'));

    const response = await buildApp().request('/api/user/subscription/sync', { method: 'POST' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'サーバー内部エラーが発生しました。' },
    });
  });

  it('rate limit 超過時は同期しない', async () => {
    redisMock.incr.mockResolvedValue(4);

    const response = await buildApp().request('/api/user/subscription/sync', { method: 'POST' });

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBeTruthy();
    expect(await response.json()).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'リクエスト数の上限に達しました。しばらく待ってから再度お試しください。',
      },
    });
    expect(syncMock).not.toHaveBeenCalled();
  });
});
