import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = vi.hoisted(() => ({ eval: vi.fn(), pttl: vi.fn() }));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: () => redis,
}));

import {
  claimVcOwnership,
  getVcOwnershipRecoveryDelayMs,
  moveVcOwnership,
  renewVcOwnership,
} from '../vc-ownership-service.js';

describe('VC ownership lease', () => {
  beforeEach(() => vi.clearAllMocks());

  it('atomically reserves both a VC and a Bot instance', async () => {
    redis.eval.mockResolvedValue(1);
    const ownership = await claimVcOwnership('guild-1', 'voice-1', 2, 'claim-a');

    expect(ownership).toEqual({ instanceId: 2, claimId: 'claim-a' });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("SET', KEYS[1]"),
      2,
      'vc-claim:guild-1:channel:voice-1',
      'vc-claim:guild-1:bot:2',
      '2:claim-a',
      '3000',
    );
  });

  it('rejects an already claimed VC or Bot', async () => {
    redis.eval.mockResolvedValue(0);
    await expect(claimVcOwnership('guild-1', 'voice-1', 2, 'claim-a')).resolves.toBeNull();
  });

  it('renews and moves ownership with a 3秒lease', async () => {
    redis.eval.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    const ownership = { instanceId: 2, claimId: 'claim-a' };
    await expect(renewVcOwnership('guild-1', 'voice-1', ownership)).resolves.toBe(true);
    await expect(moveVcOwnership('guild-1', 'voice-1', 'voice-2', ownership)).resolves.toMatchObject({ instanceId: 2 });
    expect(redis.eval).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("PEXPIRE', KEYS[1]"),
      2,
      'vc-claim:guild-1:channel:voice-1',
      'vc-claim:guild-1:bot:2',
      '2:claim-a',
      '3000',
    );
    expect(redis.eval).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SET', KEYS[3]"),
      3,
      'vc-claim:guild-1:channel:voice-1',
      'vc-claim:guild-1:bot:2',
      'vc-claim:guild-1:channel:voice-2',
      '2:claim-a',
      expect.stringMatching(/^2:/),
      '3000',
    );
  });

  it('waits for the longer VC or Bot lease before a safe recovery attempt', async () => {
    redis.pttl.mockResolvedValueOnce(9_000).mockResolvedValueOnce(12_000);

    await expect(getVcOwnershipRecoveryDelayMs('guild-1', 'voice-1', 2)).resolves.toBe(12_250);
    expect(redis.pttl).toHaveBeenCalledWith('vc-claim:guild-1:channel:voice-1');
    expect(redis.pttl).toHaveBeenCalledWith('vc-claim:guild-1:bot:2');
  });

  it('uses a short retry delay when Redis cannot provide lease TTLs', async () => {
    redis.pttl.mockRejectedValue(new Error('Redis unavailable'));
    await expect(getVcOwnershipRecoveryDelayMs('guild-1', 'voice-1', 2)).resolves.toBe(5_000);
  });
});
