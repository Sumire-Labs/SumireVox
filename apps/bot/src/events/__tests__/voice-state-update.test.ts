import type { VoiceState } from 'discord.js';
import type { GuildSettings } from '@sumirevox/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/vc-session-manager.js', () => ({
  getVcSession: vi.fn(),
  createVcSession: vi.fn(),
}));

vi.mock('../../services/guild-settings-service.js', () => ({
  getGuildSettings: vi.fn(),
  getInstanceSettings: vi.fn(),
}));

vi.mock('../../services/speech-queue.js', () => ({
  enqueue: vi.fn(),
  enqueuePreSynthesized: vi.fn(),
}));

vi.mock('../../services/predefined-audio-cache.js', () => ({
  getPredefinedAudio: vi.fn(),
}));

vi.mock('../../services/text-pipeline/index.js', () => ({
  getDictionaryTrie: vi.fn(),
  trieReplace: vi.fn(),
}));

vi.mock('../../services/auto-disconnect-timer.js', () => ({
  startDisconnectTimer: vi.fn(),
  cancelDisconnectTimer: vi.fn(),
}));

vi.mock('../../services/premium-service.js', () => ({
  canInstanceConnect: vi.fn(),
}));

vi.mock('../../infrastructure/discord-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: {
    botInstanceId: 1,
    defaultSpeakerId: 3,
  },
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { handleVoiceStateUpdate } from '../voice-state-update.js';
import { getClient } from '../../infrastructure/discord-client.js';
import { getGuildSettings } from '../../services/guild-settings-service.js';
import { enqueue } from '../../services/speech-queue.js';
import { getVcSession } from '../../services/vc-session-manager.js';
import { getDictionaryTrie, trieReplace } from '../../services/text-pipeline/index.js';

const mockGetClient = vi.mocked(getClient);
const mockGetGuildSettings = vi.mocked(getGuildSettings);
const mockEnqueue = vi.mocked(enqueue);
const mockGetVcSession = vi.mocked(getVcSession);
const mockGetDictionaryTrie = vi.mocked(getDictionaryTrie);
const mockTrieReplace = vi.mocked(trieReplace);

function makeSettings(overrides: Partial<GuildSettings> = {}): GuildSettings {
  return {
    guildId: 'guild-1',
    maxReadLength: 50,
    readUsername: false,
    addSanSuffix: false,
    romajiReading: false,
    uppercaseReading: false,
    joinLeaveNotification: true,
    greetingOnJoin: false,
    customEmojiHandling: 'read_name',
    readTargetType: 'text_sticker_and_attachment',
    defaultTextChannelId: null,
    defaultSpeakerId: 10,
    adminRoleId: null,
    dictionaryPermission: 'admin_only',
    manualPremium: false,
    ...overrides,
  };
}

function makeVoiceState(channelId: string | null, displayName: string): VoiceState {
  const voiceChannel = {
    isVoiceBased: () => true,
    members: {
      filter: vi.fn(() => ({ size: 1 })),
    },
  };

  return {
    channelId,
    member: {
      id: 'user-1',
      displayName,
      user: { bot: false },
    },
    guild: {
      id: 'guild-1',
      channels: {
        cache: {
          get: vi.fn(() => voiceChannel),
        },
      },
    },
  } as unknown as VoiceState;
}

describe('handleVoiceStateUpdate join/leave notification dictionary', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetClient.mockReturnValue({
      user: { id: 'bot-user' },
    } as ReturnType<typeof getClient>);
    mockGetVcSession.mockReturnValue({
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
    } as ReturnType<typeof getVcSession>);
    mockGetGuildSettings.mockResolvedValue(makeSettings());
    mockTrieReplace.mockImplementation((_trie, text) => text.replace('Azure', 'アジュール'));
  });

  it('displayName が辞書登録された語を含むとき、置換後の名前で enqueue する', async () => {
    mockGetDictionaryTrie.mockResolvedValue({ children: new Map(), output: null });

    await handleVoiceStateUpdate(
      makeVoiceState(null, 'Azure太郎'),
      makeVoiceState('voice-1', 'Azure太郎'),
    );

    expect(mockTrieReplace).toHaveBeenCalledWith(expect.any(Object), 'Azure太郎');
    expect(mockEnqueue).toHaveBeenCalledWith(
      'guild-1',
      'アジュール太郎が参加しました',
      10,
      1.0,
      0.0,
    );
  });

  it('getDictionaryTrie が null を返したとき、元の displayName で enqueue する', async () => {
    mockGetDictionaryTrie.mockResolvedValue(null);

    await handleVoiceStateUpdate(
      makeVoiceState(null, 'Azure太郎'),
      makeVoiceState('voice-1', 'Azure太郎'),
    );

    expect(mockTrieReplace).not.toHaveBeenCalled();
    expect(mockEnqueue).toHaveBeenCalledWith(
      'guild-1',
      'Azure太郎が参加しました',
      10,
      1.0,
      0.0,
    );
  });

  it('addSanSuffix=true のとき、さんは置換対象外で置換後の名前の末尾に付く', async () => {
    mockGetGuildSettings.mockResolvedValue(makeSettings({ addSanSuffix: true }));
    mockGetDictionaryTrie.mockResolvedValue({ children: new Map(), output: null });

    await handleVoiceStateUpdate(
      makeVoiceState('voice-1', 'Azure太郎'),
      makeVoiceState(null, 'Azure太郎'),
    );

    expect(mockTrieReplace).toHaveBeenCalledWith(expect.any(Object), 'Azure太郎');
    expect(mockEnqueue).toHaveBeenCalledWith(
      'guild-1',
      'アジュール太郎さんが退出しました',
      10,
      1.0,
      0.0,
    );
  });
});
