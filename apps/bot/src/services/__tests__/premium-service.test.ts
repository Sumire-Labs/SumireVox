import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(),
}));

vi.mock('../guild-settings-service.js', () => ({
  getGuildSettings: vi.fn(),
}));

import { getPrisma } from '../../infrastructure/database.js';
import { getGuildSettings } from '../guild-settings-service.js';
import { canInstanceConnect, getGuildActiveBoostCount } from '../premium-service.js';

const mockGetPrisma = vi.mocked(getPrisma);
const mockGetGuildSettings = vi.mocked(getGuildSettings);

function makeMockPrisma(boostCount: number) {
  return {
    boost: {
      findFirst: vi.fn(),
      count: vi.fn().mockResolvedValue(boostCount),
    },
  } as unknown as ReturnType<typeof getPrisma>;
}

function makeSettings(manualPremium: boolean) {
  return { manualPremium } as Awaited<ReturnType<typeof getGuildSettings>>;
}

describe('getGuildActiveBoostCount', () => {
  it('アクティブなブースト数を返す', async () => {
    mockGetPrisma.mockReturnValue(makeMockPrisma(3));

    const count = await getGuildActiveBoostCount('guild-1');
    expect(count).toBe(3);
  });
});

describe('canInstanceConnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1号機は常に接続可能 (ブースト0)', async () => {
    const result = await canInstanceConnect('guild-1', 1);
    expect(result).toBe(true);
  });

  it('1号機は常に接続可能 (DB アクセスなし)', async () => {
    // 1号機の場合は DB を呼ばない
    await canInstanceConnect('guild-1', 1);
    expect(mockGetGuildSettings).not.toHaveBeenCalled();
    expect(mockGetPrisma).not.toHaveBeenCalled();
  });

  it('manualPremium の場合は全インスタンスで接続可能', async () => {
    mockGetGuildSettings.mockResolvedValue(makeSettings(true));

    const result = await canInstanceConnect('guild-1', 3);
    expect(result).toBe(true);
  });

  it.each([
    [2, 0, false],
    [2, 1, true],
    [3, 1, false],
    [3, 2, true],
    [4, 3, true],
    [5, 4, true],
  ])('%d号機: ブースト数%d → %s', async (instanceId, boostCount, expected) => {
    mockGetGuildSettings.mockResolvedValue(makeSettings(false));
    mockGetPrisma.mockReturnValue(makeMockPrisma(boostCount));

    const result = await canInstanceConnect('guild-1', instanceId);

    expect(result).toBe(expected);
  });
});
