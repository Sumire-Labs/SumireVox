import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotInstance } from '@sumirevox/shared';

const pipelineMock = {
  sismember: vi.fn(),
  exec: vi.fn(),
};

const redisMock = {
  pipeline: vi.fn(() => pipelineMock),
};

vi.mock('../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

import { getGuildsWithBotStatus } from './bot-instance-service.js';

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
});
