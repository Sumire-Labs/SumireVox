import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotInstance } from '@sumirevox/shared';

const { pipelineMock, redisMock, prismaMock } = vi.hoisted(() => ({
  pipelineMock: {
    sismember: vi.fn(),
    exec: vi.fn(),
  },
  redisMock: {
    pipeline: vi.fn(),
    sismember: vi.fn(),
  },
  prismaMock: {
    botInstance: {
      findMany: vi.fn(),
    },
    guildSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    boost: {
      count: vi.fn(),
    },
  },
}));

redisMock.pipeline.mockImplementation(() => pipelineMock);

vi.mock('../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

import { getGuildBotList, getGuildsWithBotStatus } from './bot-instance-service.js';

describe('getGuildsWithBotStatus', () => {
  const instances: BotInstance[] = [
    {
      instanceId: 1,
      botUserId: 'bot-1',
      clientId: 'client-1',
      name: 'Bot 1',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      instanceId: 2,
      botUserId: 'bot-2',
      clientId: 'client-2',
      name: 'Bot 2',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  beforeEach(() => {
    pipelineMock.sismember.mockReset().mockReturnValue(pipelineMock);
    pipelineMock.exec.mockReset();
    redisMock.pipeline.mockClear();
    prismaMock.botInstance.findMany.mockReset();
    prismaMock.guildSettings.findUnique.mockReset();
    prismaMock.guildSettings.upsert.mockReset();
    prismaMock.boost.count.mockReset();
  });

  it('returns true when any instance is in the guild', async () => {
    pipelineMock.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 0],
      [null, 0],
    ]);

    const result = await getGuildsWithBotStatus(['guild-1', 'guild-2'], instances);

    expect(redisMock.pipeline).toHaveBeenCalledTimes(1);
    expect(pipelineMock.sismember).toHaveBeenCalledTimes(4);
    expect(result.get('guild-1')).toBe(true);
    expect(result.get('guild-2')).toBe(false);
  });

  it('returns false for all guilds when Redis pipeline fails', async () => {
    pipelineMock.exec.mockRejectedValue(new Error('redis error'));

    const result = await getGuildsWithBotStatus(['guild-1', 'guild-2'], instances);

    expect(result.get('guild-1')).toBe(false);
    expect(result.get('guild-2')).toBe(false);
  });

  it('returns default false map without touching Redis when input is empty', async () => {
    const result = await getGuildsWithBotStatus([], instances);

    expect(redisMock.pipeline).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('builds the guild bot list with defaults for available instances only', async () => {
    prismaMock.botInstance.findMany.mockResolvedValue([
      {
        instanceId: 1,
        botUserId: 'bot-1',
        clientId: 'client-1',
        name: 'Bot 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        instanceId: 2,
        botUserId: 'bot-2',
        clientId: 'client-2',
        name: 'Bot 2',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    prismaMock.guildSettings.findUnique
      .mockResolvedValueOnce({ manualPremium: false })
      .mockResolvedValueOnce({ manualPremium: false })
      .mockResolvedValueOnce({
        botInstanceSettings: {
          '1': {
            autoJoin: true,
            textChannelId: 'text-1',
            voiceChannelId: 'voice-1',
          },
        },
      });
    prismaMock.boost.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
    redisMock.sismember = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const result = await getGuildBotList('guild-1');

    expect(result).toEqual({
      bots: [
        {
          instanceNumber: 1,
          name: 'Bot 1',
          botUserId: 'bot-1',
          isActive: true,
          isInGuild: true,
          isAvailable: true,
          settings: {
            autoJoin: true,
            textChannelId: 'text-1',
            voiceChannelId: 'voice-1',
          },
        },
        {
          instanceNumber: 2,
          name: 'Bot 2',
          botUserId: 'bot-2',
          isActive: true,
          isInGuild: false,
          isAvailable: true,
          settings: {
            autoJoin: false,
            textChannelId: null,
            voiceChannelId: null,
          },
        },
      ],
      boostCount: 2,
      maxBots: 2,
    });
  });
});
