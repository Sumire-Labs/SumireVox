import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(),
}));

vi.mock('../../infrastructure/discord-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: { botInstanceId: 1, discordClientId: 'client-1' },
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(),
}));

import { getPrisma } from '../../infrastructure/database.js';
import { getRedisClient } from '../../infrastructure/redis.js';
import { getCopyableBotInstances } from '../bot-instance-registry.js';

const mockGetPrisma = vi.mocked(getPrisma);
const mockGetRedisClient = vi.mocked(getRedisClient);

function makeRecord(instanceId: number) {
  return {
    instanceId,
    botUserId: `bot-${instanceId}`,
    clientId: `client-${instanceId}`,
    name: `Bot ${instanceId}`,
    isActive: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('getCopyableBotInstances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('アクティブかつBOT_GUILDSに参加中で、コピー元でないBotだけを返す', async () => {
    const findMany = vi.fn().mockResolvedValue([makeRecord(1), makeRecord(2), makeRecord(3)]);
    mockGetPrisma.mockReturnValue({ botInstance: { findMany } } as unknown as ReturnType<typeof getPrisma>);
    const sismember = vi.fn(async (key: string, member: string) =>
      key === 'bot:2:guilds' && member === 'guild-1' ? 1 : 0,
    );
    mockGetRedisClient.mockReturnValue({ sismember } as unknown as ReturnType<typeof getRedisClient>);

    const candidates = await getCopyableBotInstances('guild-1', 1);

    expect(findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { instanceId: 'asc' },
    });
    expect(candidates.map((candidate) => candidate.instanceId)).toEqual([2]);
    expect(sismember).toHaveBeenCalledTimes(2);
  });

  it('ブースト判定をせず、Redis確認に失敗したBotを候補から除外する', async () => {
    mockGetPrisma.mockReturnValue({
      botInstance: { findMany: vi.fn().mockResolvedValue([makeRecord(2), makeRecord(3)]) },
    } as unknown as ReturnType<typeof getPrisma>);
    const sismember = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('redis unavailable'));
    mockGetRedisClient.mockReturnValue({ sismember } as unknown as ReturnType<typeof getRedisClient>);

    const candidates = await getCopyableBotInstances('guild-1', 1);

    expect(candidates.map((candidate) => candidate.instanceId)).toEqual([2]);
  });
});
