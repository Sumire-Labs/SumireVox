import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REDIS_KEYS } from '@sumirevox/shared';

const { redisMock, delegateBotCommandMock, getAvailableBotInstanceIdsMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
  },
  delegateBotCommandMock: vi.fn(),
  getAvailableBotInstanceIdsMock: vi.fn(),
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('../bot-command-delegation-service.js', () => ({
  delegateBotCommand: delegateBotCommandMock,
}));

vi.mock('../premium-service.js', () => ({
  getAvailableBotInstanceIds: getAvailableBotInstanceIdsMock,
}));

import {
  allocateVoiceConnection,
  inspectVoiceConnectionAllocation,
} from '../vc-allocation-service.js';

describe('vc-allocation-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAvailableBotInstanceIdsMock.mockResolvedValue([2, 1, 3]);
    redisMock.get.mockResolvedValue(null);
    delegateBotCommandMock.mockResolvedValue({ success: true, operation: 'created' });
  });

  it('優先順位順の空きBotへ手動接続を委譲する', async () => {
    const result = await allocateVoiceConnection({
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      connectionMode: 'manual',
      existingOwnerBehavior: 'update',
    });

    expect(result).toEqual({ status: 'connected', instanceId: 2 });
    expect(delegateBotCommandMock).toHaveBeenCalledWith(2, {
      action: 'join',
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      connectionMode: 'manual',
    });
  });

  it('対象VCの所有者がいれば、そのBotへTC変更を委譲する', async () => {
    redisMock.get.mockImplementation(async (key: string) => (
      key === REDIS_KEYS.VC_CLAIM('guild-1', 'voice-1') ? '3:claim-1' : null
    ));
    delegateBotCommandMock.mockResolvedValue({ success: true, operation: 'updated' });

    const result = await allocateVoiceConnection({
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-2',
      connectionMode: 'manual',
      existingOwnerBehavior: 'update',
    });

    expect(result).toEqual({ status: 'updated', instanceId: 3 });
    expect(delegateBotCommandMock).toHaveBeenCalledWith(3, expect.objectContaining({
      connectionMode: 'manual',
      textChannelId: 'text-2',
    }));
    expect(getAvailableBotInstanceIdsMock).not.toHaveBeenCalled();
  });

  it('候補Botのclaimがすべて存在する場合は容量不足を返す', async () => {
    redisMock.get.mockImplementation(async (key: string) => (
      key.includes(':bot:') ? '1:busy' : null
    ));

    const inspection = await inspectVoiceConnectionAllocation('guild-1', 'voice-1');
    const result = await allocateVoiceConnection({
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      connectionMode: 'auto',
      existingOwnerBehavior: 'preserve',
    });

    expect(inspection).toEqual({ status: 'capacity' });
    expect(result).toEqual({ status: 'capacity' });
    expect(delegateBotCommandMock).not.toHaveBeenCalled();
  });

  it('接続競合で対象VCのclaimが成立した場合は所有者へ再判定する', async () => {
    let targetClaim: string | null = null;
    redisMock.get.mockImplementation(async (key: string) => {
      if (key === REDIS_KEYS.VC_CLAIM('guild-1', 'voice-1')) return targetClaim;
      return null;
    });
    delegateBotCommandMock
      .mockImplementationOnce(async () => {
        targetClaim = '3:claim-2';
        return { success: false, message: '競合しました。' };
      })
      .mockResolvedValueOnce({ success: true, operation: 'updated' });

    const result = await allocateVoiceConnection({
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-2',
      connectionMode: 'manual',
      existingOwnerBehavior: 'update',
    });

    expect(result).toEqual({ status: 'updated', instanceId: 3 });
    expect(delegateBotCommandMock).toHaveBeenNthCalledWith(2, 3, expect.objectContaining({
      action: 'join',
      connectionMode: 'manual',
    }));
  });

  it('自動接続は既存VCを保持し、手動接続へ変更しない', async () => {
    redisMock.get.mockResolvedValue('2:claim-1');

    const result = await allocateVoiceConnection({
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      connectionMode: 'auto',
      existingOwnerBehavior: 'preserve',
    });

    expect(result).toEqual({ status: 'already-connected', instanceId: 2 });
    expect(delegateBotCommandMock).not.toHaveBeenCalled();
  });
});
