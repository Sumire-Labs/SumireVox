import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getGuildSettingsMock, getUserVoiceSettingMock, getFirstSpeakerIdMock, configMock } = vi.hoisted(
  () => ({
    getGuildSettingsMock: vi.fn(),
    getUserVoiceSettingMock: vi.fn(),
    getFirstSpeakerIdMock: vi.fn(),
    configMock: { defaultSpeakerId: 30 as number | null },
  }),
);

vi.mock('../guild-settings-service.js', () => ({
  getGuildSettings: getGuildSettingsMock,
}));

vi.mock('../user-voice-setting-service.js', () => ({
  getUserVoiceSetting: getUserVoiceSettingMock,
}));

vi.mock('../voicevox-speaker-cache.js', () => ({
  getFirstSpeakerId: getFirstSpeakerIdMock,
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: configMock,
}));

import { resolveVoiceParams } from '../speaker-resolver.js';

function makeGuildSettings(defaultSpeakerId: number | null) {
  return { defaultSpeakerId } as Awaited<ReturnType<typeof import('../guild-settings-service.js').getGuildSettings>>;
}

function makeUserVoiceSetting(speakerId: number | null, speedScale = 1.25, pitchScale = 0.1) {
  return { userId: 'user-1', speakerId, speedScale, pitchScale };
}

describe('resolveVoiceParams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFirstSpeakerIdMock.mockReturnValue(40);
    getUserVoiceSettingMock.mockResolvedValue(makeUserVoiceSetting(20));
  });

  it('applies the user speaker, speed, and pitch settings without a premium check', async () => {
    getGuildSettingsMock.mockResolvedValue(makeGuildSettings(10));

    await expect(resolveVoiceParams('user-1', 'guild-1')).resolves.toEqual({
      speakerId: 20,
      speedScale: 1.25,
      pitchScale: 0.1,
    });
  });

  it('falls back from a null user speaker to the server default while keeping user parameters', async () => {
    getGuildSettingsMock.mockResolvedValue(makeGuildSettings(10));
    getUserVoiceSettingMock.mockResolvedValue(makeUserVoiceSetting(null, 0.8, -0.05));

    await expect(resolveVoiceParams('user-1', 'guild-1')).resolves.toEqual({
      speakerId: 10,
      speedScale: 0.8,
      pitchScale: -0.05,
    });
  });

  it('falls back to the configured speaker and then the first VOICEVOX speaker', async () => {
    getGuildSettingsMock.mockResolvedValue(makeGuildSettings(null));
    getUserVoiceSettingMock.mockResolvedValue(makeUserVoiceSetting(null));

    await expect(resolveVoiceParams('user-1', 'guild-1')).resolves.toMatchObject({ speakerId: 30 });

    configMock.defaultSpeakerId = null;
    await expect(resolveVoiceParams('user-1', 'guild-1')).resolves.toMatchObject({ speakerId: 40 });
  });
});
