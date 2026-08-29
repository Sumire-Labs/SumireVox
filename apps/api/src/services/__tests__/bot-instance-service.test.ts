import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, redisMock } = vi.hoisted(() => ({
  prismaMock: {
    botInstance: {
      update: vi.fn(),
    },
  },
  redisMock: {
    del: vi.fn(),
  },
}));

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

import { setBotInstanceActive } from '../bot-instance-service.js';

describe('setBotInstanceActive', () => {
  beforeEach(() => {
    prismaMock.botInstance.update.mockReset();
    redisMock.del.mockReset();
    redisMock.del.mockResolvedValue(1);
  });

  it('invalidates both the active-count cache and the list cache', async () => {
    prismaMock.botInstance.update.mockResolvedValue({
      instanceId: 1,
      botUserId: 'bot-1',
      clientId: 'client-1',
      name: 'Main',
      isActive: true,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });

    await setBotInstanceActive(1, true);

    expect(redisMock.del).toHaveBeenCalledWith('bot:instances:active:count');
    expect(redisMock.del).toHaveBeenCalledWith('bot:instances:all');
  });
});