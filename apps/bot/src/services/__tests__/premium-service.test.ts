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

  it('2号機: ブースト数1 → 拒否', async () => {
    mockGetGuildSettings.mockResolvedValue(makeSettings(false));
    mockGetPrisma.mockReturnValue(makeMockPrisma(1));

    const result = await canInstanceConnect('guild-1', 2);
    expect(result).toBe(false);
  });

  it('2号機: ブースト数2 → 許可', async () => {
    mockGetGuildSettings.mockResolvedValue(makeSettings(false));
    mockGetPrisma.mockReturnValue(makeMockPrisma(2));

    const result = await canInstanceConnect('guild-1', 2);
    expect(result).toBe(true);
  });

  it('3号機: ブースト数2 → 拒否', async () => {
    mockGetGuildSettings.mockResolvedValue(makeSettings(false));
    mockGetPrisma.mockReturnValue(makeMockPrisma(2));

    const result = await canInstanceConnect('guild-1', 3);
    expect(result).toBe(false);
  });

  it('3号機: ブースト数3 → 許可', async () => {
    mockGetGuildSettings.mockResolvedValue(makeSettings(false));
    mockGetPrisma.mockReturnValue(makeMockPrisma(3));

    const result = await canInstanceConnect('guild-1', 3);
    expect(result).toBe(true);
  });

  it('ブースト数0 で2号機 → 拒否', async () => {
    mockGetGuildSettings.mockResolvedValue(makeSettings(false));
    mockGetPrisma.mockReturnValue(makeMockPrisma(0));

    const result = await canInstanceConnect('guild-1', 2);
    expect(result).toBe(false);
  });
});
