import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../infrastructure/app-error.js';

const { redisMock, fetchGuildChannelsMock, botInstanceServiceMock, configMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
  fetchGuildChannelsMock: vi.fn(),
  botInstanceServiceMock: {
    getActiveBotInstances: vi.fn(),
    isBotInGuild: vi.fn(),
  },
  configMock: {
    discordBotTokens: new Map<number, string>(),
  },
}));

vi.mock('../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('./discord-api.js', () => ({
  fetchGuildChannels: fetchGuildChannelsMock,
}));

vi.mock('./bot-instance-service.js', () => botInstanceServiceMock);

vi.mock('../infrastructure/config.js', () => ({ config: configMock }));

import { getGuildChannelsSorted, refreshGuildChannels } from './guild-channel-service.js';

describe('getGuildChannelsSorted', () => {
  beforeEach(() => {
    redisMock.get.mockReset();
    redisMock.set.mockReset();
    fetchGuildChannelsMock.mockReset();
    botInstanceServiceMock.getActiveBotInstances.mockReset();
    botInstanceServiceMock.isBotInGuild.mockReset();
    configMock.discordBotTokens.clear();
  });

  it('returns cached channels when present', async () => {
    const cached = {
      textChannels: [{ id: '10', name: 'general', parentId: '1', type: 'text' }],
      voiceChannels: [{ id: '20', name: 'vc', parentId: null, type: 'voice' }],
      readableChannels: [
        { id: '10', name: 'general', parentId: '1', type: 'text' },
        { id: '20', name: 'vc', parentId: null, type: 'voice' },
      ],
      categories: [{ id: '1', name: 'cat' }],
    };
    redisMock.get.mockResolvedValue(JSON.stringify(cached));

    const result = await getGuildChannelsSorted('guild-1');

    expect(redisMock.get).toHaveBeenCalledWith('guild:guild-1:channels:v2');
    expect(result).toEqual(cached);
    expect(fetchGuildChannelsMock).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('sorts and caches all readable channel types while preserving legacy candidates', async () => {
    redisMock.get.mockResolvedValue(null);
    botInstanceServiceMock.getActiveBotInstances.mockResolvedValue([{ instanceId: 1 }]);
    botInstanceServiceMock.isBotInGuild.mockResolvedValue(true);
    configMock.discordBotTokens.set(1, 'bot-token-1');
    fetchGuildChannelsMock.mockResolvedValue([
      { id: '20', name: 'Stage', type: 13, parent_id: '2', position: 4 },
      { id: '30', name: 'Text B', type: 0, parent_id: '1', position: 3 },
      { id: '1', name: 'Cat A', type: 4, parent_id: null, position: 7 },
      { id: '10', name: 'Voice A', type: 2, parent_id: '2', position: 2 },
      { id: '2', name: 'Cat B', type: 4, parent_id: null, position: 6 },
      { id: '31', name: 'Text A', type: 0, parent_id: '2', position: 1 },
      { id: '40', name: 'Announcements', type: 5, parent_id: null, position: 5 },
      { id: '99', name: 'Forum', type: 1, parent_id: null, position: 0 },
    ]);

    const result = await getGuildChannelsSorted('guild-1');

    expect(result).toEqual({
      textChannels: [
        { id: '31', name: 'Text A', parentId: '2', type: 'text' },
        { id: '30', name: 'Text B', parentId: '1', type: 'text' },
      ],
      voiceChannels: [
        { id: '10', name: 'Voice A', parentId: '2', type: 'voice' },
        { id: '20', name: 'Stage', parentId: '2', type: 'stage' },
      ],
      readableChannels: [
        { id: '31', name: 'Text A', parentId: '2', type: 'text' },
        { id: '10', name: 'Voice A', parentId: '2', type: 'voice' },
        { id: '30', name: 'Text B', parentId: '1', type: 'text' },
        { id: '20', name: 'Stage', parentId: '2', type: 'stage' },
        { id: '40', name: 'Announcements', parentId: null, type: 'announcement' },
      ],
      categories: [
        { id: '2', name: 'Cat B' },
        { id: '1', name: 'Cat A' },
      ],
    });
    expect(redisMock.set).toHaveBeenCalledWith(
      'guild:guild-1:channels:v2',
      JSON.stringify(result),
      'EX',
      120,
    );
    expect(fetchGuildChannelsMock).toHaveBeenCalledWith('guild-1', 'bot-token-1');
  });

  it('uses a joined secondary Bot token when the primary Bot is not in the guild', async () => {
    redisMock.get.mockResolvedValue(null);
    botInstanceServiceMock.getActiveBotInstances.mockResolvedValue([
      { instanceId: 1 },
      { instanceId: 2 },
    ]);
    botInstanceServiceMock.isBotInGuild.mockImplementation(async (instanceId: number) => instanceId === 2);
    configMock.discordBotTokens.set(1, 'bot-token-1');
    configMock.discordBotTokens.set(2, 'bot-token-2');
    fetchGuildChannelsMock.mockResolvedValue([]);

    await getGuildChannelsSorted('guild-1');

    expect(fetchGuildChannelsMock).toHaveBeenCalledWith('guild-1', 'bot-token-2');
  });

  it('bypasses cached channels and replaces them with Discord data when refreshed', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ voiceChannels: [] }));
    botInstanceServiceMock.getActiveBotInstances.mockResolvedValue([{ instanceId: 2 }]);
    botInstanceServiceMock.isBotInGuild.mockResolvedValue(true);
    configMock.discordBotTokens.set(2, 'bot-token-2');
    fetchGuildChannelsMock.mockResolvedValue([
      { id: '20', name: 'Latest VC', type: 2, parent_id: null, position: 1 },
    ]);

    const result = await refreshGuildChannels('guild-1');

    expect(redisMock.get).not.toHaveBeenCalled();
    expect(fetchGuildChannelsMock).toHaveBeenCalledWith('guild-1', 'bot-token-2');
    expect(result.voiceChannels).toEqual([
      { id: '20', name: 'Latest VC', parentId: null, type: 'voice' },
    ]);
    expect(redisMock.set).toHaveBeenCalledWith(
      'guild:guild-1:channels:v2',
      JSON.stringify(result),
      'EX',
      120,
    );
  });

  it('fails clearly when no joined Bot has an API token configured', async () => {
    redisMock.get.mockResolvedValue(null);
    botInstanceServiceMock.getActiveBotInstances.mockResolvedValue([{ instanceId: 2 }]);
    botInstanceServiceMock.isBotInGuild.mockResolvedValue(true);

    await expect(getGuildChannelsSorted('guild-1')).rejects.toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      statusCode: 503,
    });
    expect(fetchGuildChannelsMock).not.toHaveBeenCalled();
  });

  it('propagates Discord API failures to the route error handler', async () => {
    redisMock.get.mockResolvedValue(null);
    botInstanceServiceMock.getActiveBotInstances.mockResolvedValue([{ instanceId: 2 }]);
    botInstanceServiceMock.isBotInGuild.mockResolvedValue(true);
    configMock.discordBotTokens.set(2, 'bot-token-2');
    fetchGuildChannelsMock.mockRejectedValue(
      new AppError('DISCORD_API_ERROR', 'Failed to fetch guild channels', 500),
    );

    await expect(getGuildChannelsSorted('guild-1')).rejects.toMatchObject({
      code: 'DISCORD_API_ERROR',
      statusCode: 500,
    });
  });
});
