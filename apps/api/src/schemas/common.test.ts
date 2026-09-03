import { describe, expect, it } from 'vitest';
import { LIMITS } from '@sumirevox/shared';
import {
  autoJoinSettingsBodySchema,
} from './common.js';

const voiceChannelId = '123456789012345678';
const textChannelId = '223456789012345678';

describe('autoJoinSettingsBodySchema', () => {
  it('accepts ordered channel pairs and an empty array', () => {
    expect(
      autoJoinSettingsBodySchema.safeParse({
        autoJoin: true,
        channelPairs: [
          { voiceChannelId, textChannelId },
          { voiceChannelId: '323456789012345678', textChannelId: '423456789012345678' },
        ],
      }).success,
    ).toBe(true);
    expect(autoJoinSettingsBodySchema.safeParse({ channelPairs: [] }).success).toBe(true);
  });

  it('rejects invalid snowflakes and incomplete pairs', () => {
    expect(
      autoJoinSettingsBodySchema.safeParse({
        channelPairs: [{ voiceChannelId: 'voice', textChannelId }],
      }).success,
    ).toBe(false);
    expect(
      autoJoinSettingsBodySchema.safeParse({
        channelPairs: [{ voiceChannelId }],
      }).success,
    ).toBe(false);
    expect(
      autoJoinSettingsBodySchema.safeParse({
        channelPairs: [{ textChannelId }],
      }).success,
    ).toBe(false);
  });

  it('rejects duplicate voice channels and more than the configured limit', () => {
    expect(
      autoJoinSettingsBodySchema.safeParse({
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
    expect(autoJoinSettingsBodySchema.safeParse({ channelPairs: pairs }).success).toBe(false);
  });
});
