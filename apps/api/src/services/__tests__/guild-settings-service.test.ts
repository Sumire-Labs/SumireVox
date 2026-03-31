import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GUILD_SETTINGS_DEFAULTS, REDIS_CHANNELS } from '@sumirevox/shared';

const { prismaMock, cacheMock, pubsubMock, redisMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    guildSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
  cacheMock: {
    getCachedGuildSettings: vi.fn(),
    setCachedGuildSettings: vi.fn(),
  },
  pubsubMock: {
    publishEvent: vi.fn(),
  },
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    publish: vi.fn(),
  },
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../..//infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../../infrastructure/settings-cache.js', () => ({
  getCachedGuildSettings: cacheMock.getCachedGuildSettings,
  setCachedGuildSettings: cacheMock.setCachedGuildSettings,
}));

vi.mock('../../infrastructure/pubsub.js', () => ({
  publishEvent: pubsubMock.publishEvent,
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
  getRedisPublisher: vi.fn(() => redisMock),
  getRedisSubscriber: vi.fn(() => redisMock),
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

import { getGuildSettings, updateGuildSettings } from '../guild-settings-service.js';

describe('guild-settings-service', () => {
  beforeEach(() => {
    prismaMock.guildSettings.findUnique.mockReset();
    prismaMock.guildSettings.upsert.mockReset();
    cacheMock.getCachedGuildSettings.mockReset();
    cacheMock.setCachedGuildSettings.mockReset();
    pubsubMock.publishEvent.mockReset();
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    redisMock.publish.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
  });

  it('returns defaults for a guild with no persisted settings', async () => {
    cacheMock.getCachedGuildSettings.mockResolvedValue(null);
    prismaMock.guildSettings.findUnique.mockResolvedValue(null);

    const result = await getGuildSettings('guild-1');

    expect(result).toEqual({
      guildId: 'guild-1',
      ...GUILD_SETTINGS_DEFAULTS,
    });
    expect(cacheMock.setCachedGuildSettings).toHaveBeenCalledWith('guild-1', {
      guildId: 'guild-1',
      ...GUILD_SETTINGS_DEFAULTS,
    });
  });

  it('updates only specified fields and keeps the rest intact', async () => {
    cacheMock.getCachedGuildSettings.mockResolvedValue(null);
    prismaMock.guildSettings.findUnique.mockResolvedValue({
      guildId: 'guild-1',
      ...GUILD_SETTINGS_DEFAULTS,
    });
    prismaMock.guildSettings.upsert.mockResolvedValue({
      guildId: 'guild-1',
      ...GUILD_SETTINGS_DEFAULTS,
      maxReadLength: 200,
      readUsername: false,
    });

    const result = await updateGuildSettings('guild-1', {
      maxReadLength: 200,
      readUsername: false,
      addSanSuffix: undefined,
    });

    expect(prismaMock.guildSettings.upsert).toHaveBeenCalledWith({
      where: { guildId: 'guild-1' },
      create: {
        guildId: 'guild-1',
        ...GUILD_SETTINGS_DEFAULTS,
        maxReadLength: 200,
        readUsername: false,
      },
      update: {
        maxReadLength: 200,
        readUsername: false,
      },
    });
    expect(cacheMock.setCachedGuildSettings).toHaveBeenCalledWith('guild-1', result);
    expect(pubsubMock.publishEvent).toHaveBeenCalledWith(
      REDIS_CHANNELS.GUILD_SETTINGS_UPDATED,
      JSON.stringify({ guildId: 'guild-1' }),
    );
    expect(result.maxReadLength).toBe(200);
    expect(result.readUsername).toBe(false);
    expect(result.addSanSuffix).toBe(GUILD_SETTINGS_DEFAULTS.addSanSuffix);
  });
});
