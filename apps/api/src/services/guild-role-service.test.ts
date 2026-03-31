import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock, fetchGuildRolesMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
  fetchGuildRolesMock: vi.fn(),
}));

vi.mock('../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('./discord-api.js', () => ({
  fetchGuildRoles: fetchGuildRolesMock,
}));

import { getGuildRolesSorted } from './guild-role-service.js';

describe('getGuildRolesSorted', () => {
  beforeEach(() => {
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    fetchGuildRolesMock.mockReset();
  });

  it('returns cached roles when present', async () => {
    const cached = [{ id: '1', name: 'Admin', color: 123 }];
    redisMock.get.mockResolvedValue(JSON.stringify(cached));

    const result = await getGuildRolesSorted('guild-1');

    expect(result).toEqual(cached);
    expect(fetchGuildRolesMock).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('filters, sorts, and caches roles', async () => {
    redisMock.get.mockResolvedValue(null);
    fetchGuildRolesMock.mockResolvedValue([
      { id: '1', name: '@everyone', color: 0, position: 0, managed: false },
      { id: '2', name: 'Bot Managed', color: 1, position: 100, managed: true },
      { id: '3', name: 'Member', color: 2, position: 10, managed: false },
      { id: '4', name: 'Admin', color: 3, position: 20, managed: false },
    ]);

    const result = await getGuildRolesSorted('guild-1');

    expect(result).toEqual([
      { id: '4', name: 'Admin', color: 3 },
      { id: '3', name: 'Member', color: 2 },
    ]);
    expect(redisMock.set).toHaveBeenCalledWith(
      'guild:guild-1:roles',
      JSON.stringify(result),
      'EX',
      120,
    );
  });
});
