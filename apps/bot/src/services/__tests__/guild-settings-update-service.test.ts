import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuildSettings } from '@sumirevox/shared';

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(),
}));

vi.mock('../../infrastructure/settings-cache.js', () => ({
  invalidateGuildSettingsCache: vi.fn(),
  setCachedGuildSettings: vi.fn(),
}));

vi.mock('../../infrastructure/pubsub.js', () => ({
  publishEvent: vi.fn(),
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../guild-settings-service.js', () => ({
  getGuildSettings: vi.fn(),
  mapDbToGuildSettings: vi.fn(),
}));

vi.mock('../bot-instance-registry.js', () => ({
  getCopyableBotInstances: vi.fn(),
}));

import { getPrisma } from '../../infrastructure/database.js';
import { getGuildSettings } from '../guild-settings-service.js';
import { getCopyableBotInstances } from '../bot-instance-registry.js';
import {
  copyBotInstanceSettings,
  updateBotInstanceSettings,
} from '../guild-settings-update-service.js';
import { AppError } from '../../infrastructure/app-error.js';

const mockGetPrisma = vi.mocked(getPrisma);
const mockGetGuildSettings = vi.mocked(getGuildSettings);
const mockGetCopyableBotInstances = vi.mocked(getCopyableBotInstances);

function makeSettings(
  botInstanceSettings: GuildSettings['botInstanceSettings'] = {},
): GuildSettings {
  return {
    guildId: 'guild-1',
    maxReadLength: 50,
    readUsername: false,
    addSanSuffix: false,
    romajiReading: false,
    uppercaseReading: false,
    joinLeaveNotification: false,
    greetingOnJoin: false,
    customEmojiHandling: 'read_name',
    readTargetType: 'text_sticker_and_attachment',
    defaultTextChannelId: null,
    defaultSpeakerId: null,
    adminRoleId: null,
    dictionaryPermission: 'admin_only',
    manualPremium: false,
    botInstanceSettings,
  };
}

function makePrisma() {
  return {
    guildSettings: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  } as unknown as ReturnType<typeof getPrisma>;
}

describe('guild-settings-update-service bot instance settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPrisma.mockReturnValue(makePrisma());
    mockGetGuildSettings.mockResolvedValue(makeSettings());
  });

  it('新形式を保存し、旧フィールドを先頭ペアから維持する', async () => {
    const updated = await updateBotInstanceSettings('guild-1', 1, {
      autoJoin: true,
      channelPairs: [
        { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
        { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
      ],
    });

    expect(updated.channelPairs).toEqual([
      { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
      { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
    ]);
    const prisma = mockGetPrisma.mock.results[0]?.value as ReturnType<typeof makePrisma>;
    const input = vi.mocked(prisma.guildSettings.upsert).mock.calls[0]?.[0];
    expect(input?.update).toMatchObject({
      botInstanceSettings: {
        '1': {
          autoJoin: true,
          voiceChannelId: 'voice-1',
          textChannelId: 'text-1',
          channelPairs: [
            { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
            { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
          ],
        },
      },
    });
  });

  it('空配列は保存できる', async () => {
    const updated = await updateBotInstanceSettings('guild-1', 1, { channelPairs: [] });

    expect(updated.channelPairs).toEqual([]);
    expect(updated.voiceChannelId).toBeNull();
    expect(updated.textChannelId).toBeNull();
  });

  it('重複VC・不正値・上限超過をAppErrorで拒否する', async () => {
    await expect(
      updateBotInstanceSettings('guild-1', 1, {
        channelPairs: [
          { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
          { voiceChannelId: 'voice-1', textChannelId: 'text-2' },
        ],
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      updateBotInstanceSettings('guild-1', 1, {
        channelPairs: [{ voiceChannelId: '', textChannelId: 'text-1' }],
      }),
    ).rejects.toBeInstanceOf(AppError);

    const tooManyPairs = Array.from({ length: 26 }, (_, index) => ({
      voiceChannelId: `voice-${index}`,
      textChannelId: `text-${index}`,
    }));
    await expect(
      updateBotInstanceSettings('guild-1', 1, { channelPairs: tooManyPairs }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('旧形式に対する更新は1ペアとして保存する', async () => {
    mockGetGuildSettings.mockResolvedValue(
      makeSettings({
        '1': {
          autoJoin: true,
          voiceChannelId: 'legacy-voice',
          textChannelId: 'legacy-text',
        },
      }),
    );

    const updated = await updateBotInstanceSettings('guild-1', 1, { autoJoin: false });

    expect(updated.channelPairs).toEqual([
      { voiceChannelId: 'legacy-voice', textChannelId: 'legacy-text' },
    ]);
    expect(updated.autoJoin).toBe(false);
  });

  it('選択した複数Botへ自動接続設定だけを独立コピーする', async () => {
    mockGetGuildSettings.mockResolvedValue(
      makeSettings({
        '1': {
          autoJoin: true,
          voiceChannelId: 'legacy-voice',
          textChannelId: 'legacy-text',
        },
        '2': {
          autoJoin: false,
          voiceChannelId: 'old-voice-2',
          textChannelId: 'old-text-2',
        },
        '3': {
          autoJoin: false,
          voiceChannelId: 'old-voice-3',
          textChannelId: 'old-text-3',
        },
      }),
    );
    mockGetCopyableBotInstances.mockResolvedValue([
      {
        instanceId: 2,
        botUserId: 'bot-2',
        clientId: 'client-2',
        name: 'Bot 2',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        instanceId: 3,
        botUserId: 'bot-3',
        clientId: 'client-3',
        name: 'Bot 3',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await copyBotInstanceSettings('guild-1', 1, [2, 3]);

    const prisma = mockGetPrisma.mock.results[0]?.value as ReturnType<typeof makePrisma>;
    const input = vi.mocked(prisma.guildSettings.upsert).mock.calls[0]?.[0];
    const settingsMap = input?.update?.botInstanceSettings as Record<string, Record<string, unknown>>;
    expect(settingsMap['2']).toMatchObject({
      autoJoin: true,
      voiceChannelId: 'legacy-voice',
      textChannelId: 'legacy-text',
      channelPairs: [{ voiceChannelId: 'legacy-voice', textChannelId: 'legacy-text' }],
    });
    expect(settingsMap['3']).toMatchObject(settingsMap['2']);
    expect(settingsMap['2']?.channelPairs).not.toBe(settingsMap['3']?.channelPairs);
  });
});
