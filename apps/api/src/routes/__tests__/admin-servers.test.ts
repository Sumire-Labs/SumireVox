import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { botServiceMock, getGuildInfoMock, prismaMock } = vi.hoisted(() => ({
  botServiceMock: {
    getAllBotInstances: vi.fn(),
    getBotGuildMemberships: vi.fn(),
    setBotInstanceActive: vi.fn(),
    getGuildBotList: vi.fn(),
    updateGuildBotInstanceSettings: vi.fn(),
  },
  getGuildInfoMock: vi.fn(),
  prismaMock: {
    guildSettings: {
      findMany: vi.fn(),
    },
    boost: {
      groupBy: vi.fn(),
    },
  },
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: { botAdminUserIds: ['admin'] },
}));

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../../infrastructure/discord-guild-info.js', () => ({
  getGuildInfo: getGuildInfoMock,
}));

vi.mock('../../services/bot-instance-service.js', () => botServiceMock);

import { errorHandler } from '../../middleware/error-handler.js';
import { adminRouter } from '../admin.js';

function buildApp(): Hono {
  const app = new Hono();
  app.onError(errorHandler);
  app.use('/api/admin/*', async (c, next) => {
    c.set('session', {
      userId: 'admin',
      username: 'admin',
      discriminator: '0',
      avatar: null,
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenExpiresAt: Date.now() + 60_000,
    });
    await next();
  });
  app.route('/api/admin', adminRouter);
  return app;
}

describe('GET /api/admin/servers', () => {
  beforeEach(() => {
    botServiceMock.getAllBotInstances.mockReset();
    botServiceMock.getBotGuildMemberships.mockReset();
    getGuildInfoMock.mockReset();
    prismaMock.guildSettings.findMany.mockReset();
    prismaMock.boost.groupBy.mockReset();
  });

  it('returns active boost counts and installed active/inactive bot instances', async () => {
    botServiceMock.getAllBotInstances.mockResolvedValue([
      { instanceId: 1, botUserId: 'bot-1', clientId: 'client-1', name: 'Primary', isActive: true },
      { instanceId: 2, botUserId: 'bot-2', clientId: 'client-2', name: 'Secondary', isActive: false },
    ]);
    botServiceMock.getBotGuildMemberships.mockResolvedValue(
      new Map([
        ['guild-1', [1, 2]],
        ['guild-2', [1]],
      ]),
    );
    prismaMock.guildSettings.findMany.mockResolvedValue([{ guildId: 'guild-1', manualPremium: true }]);
    prismaMock.boost.groupBy.mockResolvedValue([{ guildId: 'guild-1', _count: { id: 2 } }]);
    getGuildInfoMock.mockImplementation(async (guildId: string) => ({
      name: guildId,
      icon: null,
      botJoinedAt: null,
    }));

    const response = await buildApp().request('/api/admin/servers?page=1&perPage=20');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: {
        items: [
          {
            guildId: 'guild-1',
            name: 'guild-1',
            icon: null,
            manualPremium: true,
            botJoinedAt: null,
            boostCount: 2,
            botInstances: [
              { instanceId: 1, name: 'Primary', isActive: true },
              { instanceId: 2, name: 'Secondary', isActive: false },
            ],
          },
          {
            guildId: 'guild-2',
            name: 'guild-2',
            icon: null,
            manualPremium: false,
            botJoinedAt: null,
            boostCount: 0,
            botInstances: [{ instanceId: 1, name: 'Primary', isActive: true }],
          },
        ],
        total: 2,
        page: 1,
        perPage: 20,
      },
    });
    expect(prismaMock.boost.groupBy).toHaveBeenCalledWith({
      by: ['guildId'],
      where: {
        guildId: { in: ['guild-1', 'guild-2'] },
        subscription: { status: 'ACTIVE' },
      },
      _count: { id: true },
    });
  });

  it('returns an empty page without querying boost counts when no bot guilds exist', async () => {
    botServiceMock.getAllBotInstances.mockResolvedValue([]);
    botServiceMock.getBotGuildMemberships.mockResolvedValue(new Map());

    const response = await buildApp().request('/api/admin/servers');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { items: [], total: 0, page: 1, perPage: 20 },
    });
    expect(prismaMock.boost.groupBy).not.toHaveBeenCalled();
  });
});
