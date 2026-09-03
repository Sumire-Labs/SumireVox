import { describe, expect, it } from 'vitest';
import type { ResolvedAutoJoinSettings } from '@sumirevox/shared';
import {
  appendChannelPair,
  applyAutoJoinSettingsPatch,
  applyChannelPairs,
  canAddChannelPair,
  createEmptyAutoJoinSettings,
  getAvailableVoiceChannelIds,
  removeChannelPair,
  updateChannelPair,
} from './server-bots-helpers';

const firstPair = { voiceChannelId: 'voice-1', textChannelId: 'text-1' };
const secondPair = { voiceChannelId: 'voice-2', textChannelId: 'text-2' };

describe('server bot settings helpers', () => {
  it('adds complete pairs and rejects an incomplete or duplicate VC', () => {
    expect(canAddChannelPair([], firstPair)).toBe(true);
    expect(appendChannelPair([], firstPair)).toEqual([firstPair]);
    expect(canAddChannelPair([firstPair], { ...firstPair, textChannelId: 'text-3' })).toBe(false);
    expect(canAddChannelPair([], { voiceChannelId: firstPair.voiceChannelId })).toBe(false);
    expect(appendChannelPair([firstPair], secondPair)).toEqual([firstPair, secondPair]);
  });

  it('edits and removes pairs without changing the order of the remaining pairs', () => {
    const pairs = [firstPair, secondPair];
    expect(updateChannelPair(pairs, 1, { textChannelId: 'text-2-updated' })).toEqual([
      firstPair,
      { voiceChannelId: 'voice-2', textChannelId: 'text-2-updated' },
    ]);
    expect(removeChannelPair(pairs, 0)).toEqual([secondPair]);
    expect(removeChannelPair(pairs, 99)).toEqual(pairs);
  });

  it('keeps shared settings normalized when pairs are replaced or cleared', () => {
    const settings: ResolvedAutoJoinSettings = {
      autoJoin: true,
      channelPairs: [firstPair],
    };
    expect(applyChannelPairs(settings, [secondPair])).toEqual({
      autoJoin: true,
      channelPairs: [secondPair],
    });
    expect(applyChannelPairs(settings, [])).toEqual({
      ...createEmptyAutoJoinSettings(),
      autoJoin: true,
    });
    expect(applyAutoJoinSettingsPatch(settings, { autoJoin: false })).toEqual({
      ...settings,
      autoJoin: false,
    });
  });

  it('calculates used VC IDs', () => {
    expect(getAvailableVoiceChannelIds([firstPair, secondPair])).toEqual(
      new Set(['voice-1', 'voice-2']),
    );
  });
});
