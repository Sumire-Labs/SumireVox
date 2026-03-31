import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock, fetchGuildChannelsMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
  fetchGuildChannelsMock: vi.fn(),
}));

vi.mock('../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('./discord-api.js', () => ({
  fetchGuildChannels: fetchGuildChannelsMock,
}));

import { getGuildChannelsSorted } from './guild-channel-service.js';

describe('getGuildChannelsSorted', () => {
  beforeEach(() => {
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    fetchGuildChannelsMock.mockReset();
  });

  it('returns cached channels when present', async () => {
    const cached = {
      textChannels: [{ id: '10', name: 'general', parentId: '1' }],
      voiceChannels: [{ id: '20', name: 'vc', parentId: null }],
      categories: [{ id: '1', name: 'cat' }],
    };
    redisMock.get.mockResolvedValue(JSON.stringify(cached));

    const result = await getGuildChannelsSorted('guild-1');

    expect(result).toEqual(cached);
    expect(fetchGuildChannelsMock).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('sorts and caches channels by type', async () => {
    redisMock.get.mockResolvedValue(null);
    fetchGuildChannelsMock.mockResolvedValue([
      { id: '20', name: 'Stage', type: 13, parent_id: '2', position: 2 },
      { id: '30', name: 'Text B', type: 0, parent_id: '1', position: 3 },
      { id: '1', name: 'Cat A', type: 4, parent_id: null, position: 2 },
      { id: '10', name: 'Voice A', type: 2, parent_id: '2', position: 1 },
      { id: '2', name: 'Cat B', type: 4, parent_id: null, position: 1 },
      { id: '31', name: 'Text A', type: 0, parent_id: '2', position: 1 },
    ]);

    const result = await getGuildChannelsSorted('guild-1');

    expect(result).toEqual({
      textChannels: [
        { id: '31', name: 'Text A', parentId: '2' },
        { id: '30', name: 'Text B', parentId: '1' },
      ],
      voiceChannels: [
        { id: '10', name: 'Voice A', parentId: '2' },
        { id: '20', name: 'Stage', parentId: '2' },
      ],
      categories: [
        { id: '2', name: 'Cat B' },
        { id: '1', name: 'Cat A' },
      ],
    });
    expect(redisMock.set).toHaveBeenCalledWith(
      'guild:guild-1:channels',
      JSON.stringify(result),
      'EX',
      120,
    );
  });
});
