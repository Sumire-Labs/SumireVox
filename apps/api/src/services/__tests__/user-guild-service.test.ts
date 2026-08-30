import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchUserGuildsMock, redisMock, loggerMock } = vi.hoisted(() => ({
  fetchUserGuildsMock: vi.fn(),
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
  loggerMock: {
    warn: vi.fn(),
  },
}));

vi.mock('../discord-api.js', () => ({
  fetchUserGuilds: fetchUserGuildsMock,
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: () => redisMock,
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

import { getUserGuilds } from '../user-guild-service.js';

const guilds = [
  {
    id: 'guild-1',
    name: 'Guild',
    icon: null,
    owner: true,
    permissions: '0',
  },
];

describe('getUserGuilds', () => {
  beforeEach(() => {
    fetchUserGuildsMock.mockReset();
    redisMock.get.mockReset().mockResolvedValue(null);
    redisMock.set.mockReset().mockResolvedValue('OK');
  });

  it('caches the complete Discord guild records', async () => {
    fetchUserGuildsMock.mockResolvedValue(guilds);

    await expect(getUserGuilds('user-1', 'access-token')).resolves.toEqual(guilds);

    expect(fetchUserGuildsMock).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenCalledWith(
      'user:user-1:all-guilds',
      JSON.stringify(guilds),
      'EX',
      60,
    );
  });

  it('uses the cached records without calling Discord', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify(guilds));

    await expect(getUserGuilds('user-1', 'access-token')).resolves.toEqual(guilds);

    expect(fetchUserGuildsMock).not.toHaveBeenCalled();
  });
});
