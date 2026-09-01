import { describe, expect, it } from 'vitest';
import {
  cloneBotInstanceSettings,
  normalizeBotInstanceSettings,
} from '../normalize-bot-instance-settings.js';
import { LIMITS } from '../../constants/limits.js';

describe('normalizeBotInstanceSettings', () => {
  it('旧形式のVC/TCを1ペアへ読み替える', () => {
    expect(
      normalizeBotInstanceSettings({
        autoJoin: true,
        voiceChannelId: 'voice-1',
        textChannelId: 'text-1',
      }),
    ).toEqual({
      autoJoin: true,
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      channelPairs: [{ voiceChannelId: 'voice-1', textChannelId: 'text-1' }],
    });
  });

  it('channelPairsが存在する場合は旧形式より優先する', () => {
    expect(
      normalizeBotInstanceSettings({
        autoJoin: true,
        voiceChannelId: 'legacy-voice',
        textChannelId: 'legacy-text',
        channelPairs: [{ voiceChannelId: 'voice-2', textChannelId: 'text-2' }],
      }).channelPairs,
    ).toEqual([{ voiceChannelId: 'voice-2', textChannelId: 'text-2' }]);
  });

  it('不正なペアと同一VCの重複を除外する', () => {
    expect(
      normalizeBotInstanceSettings({
        channelPairs: [
          { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
          { voiceChannelId: 'voice-1', textChannelId: 'text-2' },
          { voiceChannelId: 'voice-2', textChannelId: '' },
          { voiceChannelId: 'voice-3', textChannelId: 'text-3' },
        ],
      }).channelPairs,
    ).toEqual([
      { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
      { voiceChannelId: 'voice-3', textChannelId: 'text-3' },
    ]);
  });

  it('ペア数をDiscord UIの上限へ切り詰める', () => {
    const pairs = Array.from({ length: LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS + 1 }, (_, index) => ({
      voiceChannelId: `voice-${index}`,
      textChannelId: `text-${index}`,
    }));

    expect(normalizeBotInstanceSettings({ channelPairs: pairs }).channelPairs).toHaveLength(
      LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS,
    );
  });
});

describe('cloneBotInstanceSettings', () => {
  it('channelPairsを参照共有しない', () => {
    const original = normalizeBotInstanceSettings({
      autoJoin: true,
      channelPairs: [{ voiceChannelId: 'voice-1', textChannelId: 'text-1' }],
    });
    const cloned = cloneBotInstanceSettings(original);

    expect(cloned).toEqual(original);
    expect(cloned.channelPairs).not.toBe(original.channelPairs);
    expect(cloned.channelPairs[0]).not.toBe(original.channelPairs[0]);
  });
});
