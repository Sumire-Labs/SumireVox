import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { botServiceMock, discordApiMock, guildChannelServiceMock, redisMock, publishEventMock } = vi.hoisted(() => ({
  botServiceMock: {
    copyBotInstanceSettings: vi.fn(),
    getActiveBotInstances: vi.fn(),
    getAvailableBotCount: vi.fn(),
    getBotGuilds: vi.fn(),
    getBotGuildMemberships: vi.fn(),
    getGuildBotList: vi.fn(),
    getGuildsWithBotStatus: vi.fn(),
    generateBotInviteUrl: vi.fn(),
    updateGuildBotInstanceSettings: vi.fn(),
  },
  discordApiMock: {
    fetchManagedGuilds: vi.fn(),
    hasManageGuildPermission: vi.fn(),
  },
  guildChannelServiceMock: {
    getGuildChannelsSorted: vi.fn(),
  },
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
  publishEventMock: vi.fn(),
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: { discordClientId: 'client-1', webDomain: 'http://localhost:5173' },
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../middleware/rate-limit.js', () => ({
  rateLimit: vi.fn(() => async (_context: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock('../../services/bot-instance-service.js', () => botServiceMock);
vi.mock('../../services/discord-api.js', () => discordApiMock);
vi.mock('../../services/dictionary-service.js', () => ({
  addServerDictionaryEntry: vi.fn(),
  deleteServerDictionaryEntry: vi.fn(),
  getServerDictionaryEntries: vi.fn(),
  isGuildPremium: vi.fn(),
}));
vi.mock('../../services/guild-channel-service.js', () => guildChannelServiceMock);
vi.mock('../../services/guild-role-service.js', () => ({ getGuildRolesSorted: vi.fn() }));
vi.mock('../../services/guild-settings-service.js', () => ({
  getGuildSettings: vi.fn(),
  updateGuildSettings: vi.fn(),
}));
vi.mock('../../infrastructure/pubsub.js', () => ({ publishEvent: publishEventMock }));

import { errorHandler } from '../../middleware/error-handler.js';
import { guildsRouter } from '../guilds.js';
import { AppError } from '../../infrastructure/app-error.js';

function buildApp(authenticated: boolean): Hono {
  const app = new Hono();
  app.onError(errorHandler);
  if (authenticated) {
    app.use('/api/guilds/*', async (c, next) => {
      c.set('session', {
        userId: 'user-1',
        username: 'user',
        discriminator: '0',
        avatar: null,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenExpiresAt: Date.now() + 60_000,
      });
      await next();
    });
  }
  app.route('/api/guilds', guildsRouter);
  return app;
}

describe('GET /api/guilds/:guildId/channels', () => {
  beforeEach(() => {
    discordApiMock.hasManageGuildPermission.mockReset().mockResolvedValue(true);
    guildChannelServiceMock.getGuildChannelsSorted.mockReset();
    redisMock.get.mockReset().mockResolvedValue(null);
    redisMock.set.mockReset().mockResolvedValue('OK');
  });

  it('returns channels from a joined secondary Bot through the existing API contract', async () => {
    const channels = {
      textChannels: [{ id: '123456789012345678', name: 'general', parentId: null, type: 'text' }],
      voiceChannels: [{ id: '223456789012345678', name: 'VC', parentId: null, type: 'voice' }],
      readableChannels: [
        { id: '123456789012345678', name: 'general', parentId: null, type: 'text' },
        { id: '223456789012345678', name: 'VC', parentId: null, type: 'voice' },
      ],
      categories: [],
    };
    guildChannelServiceMock.getGuildChannelsSorted.mockResolvedValue(channels);

    const response = await buildApp(true).request('/api/guilds/123456789012345678/channels');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: channels });
    expect(guildChannelServiceMock.getGuildChannelsSorted).toHaveBeenCalledWith('123456789012345678');
  });

  it('returns a visible service error when no joined Bot can retrieve channels', async () => {
    guildChannelServiceMock.getGuildChannelsSorted.mockRejectedValue(
      new AppError('SERVICE_UNAVAILABLE', 'チャンネル一覧を取得できる参加中の Bot が見つかりません。', 503),
    );

    const response = await buildApp(true).request('/api/guilds/123456789012345678/channels');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'チャンネル一覧を取得できる参加中の Bot が見つかりません。',
      },
    });
  });
});

describe('POST /api/guilds/:guildId/bots/:instanceId/settings/copy', () => {
  beforeEach(() => {
    botServiceMock.copyBotInstanceSettings.mockReset();
    discordApiMock.hasManageGuildPermission.mockReset().mockResolvedValue(true);
    redisMock.get.mockReset().mockResolvedValue(null);
    redisMock.set.mockReset().mockResolvedValue('OK');
    publishEventMock.mockReset().mockResolvedValue(1);
  });

  it('requires authentication and guild management permission', async () => {
    const unauthenticatedResponse = await buildApp(false).request(
      '/api/guilds/123456789012345678/bots/1/settings/copy',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetInstanceIds: [2] }),
      },
    );
    expect(unauthenticatedResponse.status).toBe(401);

    discordApiMock.hasManageGuildPermission.mockResolvedValue(false);
    const forbiddenResponse = await buildApp(true).request(
      '/api/guilds/123456789012345678/bots/1/settings/copy',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetInstanceIds: [2] }),
      },
    );
    expect(forbiddenResponse.status).toBe(403);
    expect(botServiceMock.copyBotInstanceSettings).not.toHaveBeenCalled();
  });

  it('copies settings and publishes one guild update event', async () => {
    botServiceMock.copyBotInstanceSettings.mockResolvedValue({
      autoJoin: true,
      voiceChannelId: '123456789012345678',
      textChannelId: '223456789012345678',
      channelPairs: [
        { voiceChannelId: '123456789012345678', textChannelId: '223456789012345678' },
      ],
    });

    const response = await buildApp(true).request(
      '/api/guilds/123456789012345678/bots/1/settings/copy',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetInstanceIds: [2, 3] }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: null });
    expect(botServiceMock.copyBotInstanceSettings).toHaveBeenCalledWith(
      '123456789012345678',
      1,
      [2, 3],
    );
    expect(publishEventMock).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate targets before calling the copy service', async () => {
    const response = await buildApp(true).request(
      '/api/guilds/123456789012345678/bots/1/settings/copy',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetInstanceIds: [2, 2] }),
      },
    );

    expect(response.status).toBe(400);
    const body = (await response.json()) as { success: boolean; error: { code: string } };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(botServiceMock.copyBotInstanceSettings).not.toHaveBeenCalled();
    expect(publishEventMock).not.toHaveBeenCalled();
  });

  it('does not publish when the copy service rejects the request', async () => {
    botServiceMock.copyBotInstanceSettings.mockRejectedValue(
      new AppError('VALIDATION_ERROR', 'コピー先のBotが利用できません。', 400),
    );

    const response = await buildApp(true).request(
      '/api/guilds/123456789012345678/bots/1/settings/copy',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetInstanceIds: [2] }),
      },
    );

    expect(response.status).toBe(400);
    expect(publishEventMock).not.toHaveBeenCalled();
  });
});
