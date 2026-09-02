import { describe, expect, it } from 'vitest';
import { LIMITS } from '@sumirevox/shared';
import {
  botInstanceSettingsCopyBodySchema,
  guildBotInstanceSettingsBodySchema,
} from './common.js';

const voiceChannelId = '123456789012345678';
const textChannelId = '223456789012345678';

describe('guildBotInstanceSettingsBodySchema', () => {
  it('accepts ordered channel pairs and an empty array', () => {
    expect(
      guildBotInstanceSettingsBodySchema.safeParse({
        autoJoin: true,
        channelPairs: [
          { voiceChannelId, textChannelId },
          { voiceChannelId: '323456789012345678', textChannelId: '423456789012345678' },
        ],
      }).success,
    ).toBe(true);
    expect(guildBotInstanceSettingsBodySchema.safeParse({ channelPairs: [] }).success).toBe(true);
  });

  it('continues to accept legacy channel fields', () => {
    expect(
      guildBotInstanceSettingsBodySchema.safeParse({
        autoJoin: false,
        voiceChannelId: 'legacy-voice-id',
        textChannelId: 'legacy-text-id',
      }).success,
    ).toBe(true);
  });

  it('rejects invalid snowflakes and incomplete pairs', () => {
    expect(
      guildBotInstanceSettingsBodySchema.safeParse({
        channelPairs: [{ voiceChannelId: 'voice', textChannelId }],
      }).success,
    ).toBe(false);
    expect(
      guildBotInstanceSettingsBodySchema.safeParse({
        channelPairs: [{ voiceChannelId }],
      }).success,
    ).toBe(false);
    expect(
      guildBotInstanceSettingsBodySchema.safeParse({
        channelPairs: [{ textChannelId }],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate voice channels and more than the configured limit', () => {
    expect(
      guildBotInstanceSettingsBodySchema.safeParse({
        channelPairs: [
          { voiceChannelId, textChannelId },
          { voiceChannelId, textChannelId: '323456789012345678' },
        ],
      }).success,
    ).toBe(false);

    const pairs = Array.from({ length: LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS + 1 }, (_, index) => ({
      voiceChannelId: `${index + 1}23456789012345678`,
      textChannelId: `${index + 2}23456789012345678`,
    }));
    expect(guildBotInstanceSettingsBodySchema.safeParse({ channelPairs: pairs }).success).toBe(false);
  });
});

describe('botInstanceSettingsCopyBodySchema', () => {
  it('accepts unique positive target instance IDs', () => {
    expect(botInstanceSettingsCopyBodySchema.safeParse({ targetInstanceIds: [2, 3] }).success).toBe(true);
  });

  it('rejects empty and duplicate target instance IDs', () => {
    expect(botInstanceSettingsCopyBodySchema.safeParse({ targetInstanceIds: [] }).success).toBe(false);
    expect(botInstanceSettingsCopyBodySchema.safeParse({ targetInstanceIds: [2, 2] }).success).toBe(false);
  });
});
