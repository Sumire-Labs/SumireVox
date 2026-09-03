import type {
  BotInstance,
  BotInstanceSettings,
  GuildSettings,
  ResolvedBotInstanceSettings,
} from '@sumirevox/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/guild-settings-service.js', () => ({
  getGuildSettings: vi.fn(),
  getInstanceSettings: vi.fn(),
  getAutoJoinSettings: vi.fn(),
}));

vi.mock('../../services/guild-settings-update-service.js', () => ({
  copyBotInstanceSettings: vi.fn(),
  updateGuildSettings: vi.fn(),
  updateBotInstanceSettings: vi.fn(),
  updateAutoJoinSettings: vi.fn(),
}));

vi.mock('../../services/bot-instance-registry.js', () => ({
  getCopyableBotInstances: vi.fn(),
}));

vi.mock('../../services/voicevox-speaker-cache.js', () => ({
  getSpeakers: vi.fn(),
  getSpeakerStyleName: vi.fn(),
}));

vi.mock('../../services/premium-service.js', () => ({
  isGuildPremium: vi.fn(),
}));

vi.mock('../../infrastructure/discord-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: { botInstanceId: 1, defaultSpeakerId: 10 },
}));

import { getGuildSettings, getInstanceSettings, getAutoJoinSettings } from '../../services/guild-settings-service.js';
import {
  copyBotInstanceSettings,
  updateBotInstanceSettings,
  updateAutoJoinSettings,
} from '../../services/guild-settings-update-service.js';
import { getCopyableBotInstances } from '../../services/bot-instance-registry.js';
import { getClient } from '../../infrastructure/discord-client.js';
import {
  buildSettingsMessage,
  handleSettingsView,
} from '../settings-view-handler.js';

const mockGetGuildSettings = vi.mocked(getGuildSettings);
const mockGetInstanceSettings = vi.mocked(getInstanceSettings);
const mockGetAutoJoinSettings = vi.mocked(getAutoJoinSettings);
const mockUpdateBotInstanceSettings = vi.mocked(updateBotInstanceSettings);
const mockUpdateAutoJoinSettings = vi.mocked(updateAutoJoinSettings);
const mockGetCopyableBotInstances = vi.mocked(getCopyableBotInstances);
const mockCopyBotInstanceSettings = vi.mocked(copyBotInstanceSettings);
const mockGetClient = vi.mocked(getClient);

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

function makeInstanceSettings(): ResolvedBotInstanceSettings {
  return {
    autoJoin: true,
    voiceChannelId: 'voice-1',
    textChannelId: 'text-1',
    channelPairs: [{ voiceChannelId: 'voice-1', textChannelId: 'text-1' }],
  };
}

function makeBot(instanceId: number): BotInstance {
  return {
    instanceId,
    botUserId: `bot-${instanceId}`,
    clientId: `client-${instanceId}`,
    name: `Bot ${instanceId}`,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function getSerializedComponents(components: readonly { toJSON(): unknown }[]): string {
  return JSON.stringify(components.map((component) => component.toJSON()));
}

function findCustomId(value: unknown, action: string): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findCustomId(item, action);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.custom_id === 'string' && record.custom_id.includes(`:${action}:`)) {
    return record.custom_id;
  }
  for (const child of Object.values(record)) {
    const found = findCustomId(child, action);
    if (found) return found;
  }
  return undefined;
}

function makeInteraction(kind: 'button' | 'channel' | 'string', values: string[] = []) {
  const interaction = {
    guildId: 'guild-1',
    user: { id: 'user-1' },
    values,
    customId: 'settings:unused:user-1:9999999999',
    replied: false,
    deferred: false,
    isButton: () => kind === 'button',
    isChannelSelectMenu: () => kind === 'channel',
    isStringSelectMenu: () => kind === 'string',
    isModalSubmit: () => false,
    isRoleSelectMenu: () => false,
    update: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
  };
  return interaction;
}

describe('settings-view-handler connection UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuildSettings.mockResolvedValue(makeSettings());
    mockGetInstanceSettings.mockReturnValue(makeInstanceSettings());
    mockGetAutoJoinSettings.mockReturnValue(makeInstanceSettings());
    mockGetClient.mockReturnValue({ user: { username: 'SumireVox' } } as unknown as ReturnType<typeof getClient>);
    mockGetCopyableBotInstances.mockResolvedValue([makeBot(2), makeBot(3)]);
    mockCopyBotInstanceSettings.mockResolvedValue({
      autoJoin: true,
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      channelPairs: [{ voiceChannelId: 'voice-1', textChannelId: 'text-1' }],
    } satisfies BotInstanceSettings);
  });

  it('旧形式を共通ペア一覧として表示し、追加・削除操作を表示する', () => {
    const settings = makeSettings();
    const oldSettings: BotInstanceSettings = {
      autoJoin: true,
      voiceChannelId: 'legacy-voice',
      textChannelId: 'legacy-text',
    };

    const { components } = buildSettingsMessage(
      settings,
      'connection',
      'user-1',
      oldSettings,
      'Bot 1',
    );
    const serialized = getSerializedComponents(components);

    expect(serialized).toContain('legacy-voice');
    expect(serialized).toContain('legacy-text');
    expect(serialized).toContain('pair_remove');
    expect(serialized).toContain('pair_add');
  });

  it('ペア追加はVC選択後にTC選択画面へ進み、TC選択時だけ保存する', async () => {
    const addButton = makeInteraction('button');
    await handleSettingsView(addButton as never, {
      command: 'settings',
      action: 'pair_add',
      userId: 'user-1',
      timestamp: 9999999999,
    });
    expect(addButton.update).toHaveBeenCalled();
    expect(getSerializedComponents(addButton.update.mock.calls[0]?.[0].components)).toContain(
      'pair_add_voice',
    );
    expect(mockUpdateAutoJoinSettings).not.toHaveBeenCalled();

    const channels = new Map([
      ['voice-2', { isVoiceBased: () => true }],
      ['text-2', { isTextBased: () => true }],
    ]);
    const voiceInteraction = makeInteraction('channel', ['voice-2']);
    Object.assign(voiceInteraction, {
      guild: { channels: { cache: { get: (id: string) => channels.get(id) } } },
    });
    await handleSettingsView(voiceInteraction as never, {
      command: 'settings',
      action: 'pair_add_voice',
      userId: 'user-1',
      timestamp: 9999999999,
    });
    expect(mockUpdateAutoJoinSettings).not.toHaveBeenCalled();
    expect(getSerializedComponents(voiceInteraction.update.mock.calls[0]?.[0].components)).toContain(
      'pair_add_text:voice-2',
    );

    const textInteraction = makeInteraction('channel', ['text-2']);
    Object.assign(textInteraction, {
      guild: { channels: { cache: { get: (id: string) => channels.get(id) } } },
    });
    await handleSettingsView(textInteraction as never, {
      command: 'settings',
      action: 'pair_add_text:voice-2',
      userId: 'user-1',
      timestamp: 9999999999,
    });
    expect(mockUpdateAutoJoinSettings).toHaveBeenCalledWith('guild-1', {
      channelPairs: [
        { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
        { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
      ],
    });
  });

});
