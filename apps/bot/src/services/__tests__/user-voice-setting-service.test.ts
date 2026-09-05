import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, getCachedUserVoiceSettingMock, setCachedUserVoiceSettingMock } = vi.hoisted(() => ({
  prismaMock: {
    userVoiceSetting: {
      findUnique: vi.fn(),
    },
  },
  getCachedUserVoiceSettingMock: vi.fn(),
  setCachedUserVoiceSettingMock: vi.fn(),
}));

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../../infrastructure/settings-cache.js', () => ({
  getCachedUserVoiceSetting: getCachedUserVoiceSettingMock,
  setCachedUserVoiceSetting: setCachedUserVoiceSettingMock,
}));

vi.mock('../../infrastructure/pubsub.js', () => ({
  publishEvent: vi.fn(),
}));

import { getUserVoiceSetting } from '../user-voice-setting-service.js';

describe('getUserVoiceSetting', () => {
  beforeEach(() => {
    getCachedUserVoiceSettingMock.mockReset().mockResolvedValue(null);
    setCachedUserVoiceSettingMock.mockReset().mockResolvedValue(undefined);
    prismaMock.userVoiceSetting.findUnique.mockReset().mockResolvedValue(null);
  });

  it('caches default settings when no database record exists', async () => {
    const result = await getUserVoiceSetting('user-1');

    expect(result).toEqual({
      userId: 'user-1',
      speakerId: null,
      speedScale: 1,
      pitchScale: 0,
    });
    expect(prismaMock.userVoiceSetting.findUnique).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(setCachedUserVoiceSettingMock).toHaveBeenCalledWith('user-1', result);
  });
});
