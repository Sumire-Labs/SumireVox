import { describe, expect, it } from 'vitest';
import type { ResolvedBotInstanceSettings } from '@sumirevox/shared';
import {
  appendChannelPair,
  applyBotSettingsPatch,
  applyChannelPairs,
  canAddChannelPair,
  createEmptyBotInstanceSettings,
  getAvailableVoiceChannelIds,
  getCopyableBotInfos,
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

  it('keeps the first pair mirrored in legacy fields and supports clearing all pairs', () => {
    const settings: ResolvedBotInstanceSettings = {
      autoJoin: true,
      voiceChannelId: firstPair.voiceChannelId,
      textChannelId: firstPair.textChannelId,
      channelPairs: [firstPair],
    };
    expect(applyChannelPairs(settings, [secondPair])).toEqual({
      autoJoin: true,
      voiceChannelId: secondPair.voiceChannelId,
      textChannelId: secondPair.textChannelId,
      channelPairs: [secondPair],
    });
    expect(applyChannelPairs(settings, [])).toEqual({
      ...createEmptyBotInstanceSettings(),
      autoJoin: true,
    });
    expect(applyBotSettingsPatch(settings, { autoJoin: false })).toEqual({
      ...settings,
      autoJoin: false,
    });
  });

  it('calculates used VCs and filters copy candidates by active guild membership', () => {
    expect(getAvailableVoiceChannelIds([firstPair, secondPair])).toEqual(
      new Set(['voice-1', 'voice-2']),
    );
    const bots = [
      { instanceNumber: 1, name: 'source', isActive: true, isInGuild: true, isAvailable: true },
      { instanceNumber: 2, name: 'target', isActive: true, isInGuild: true, isAvailable: false },
      { instanceNumber: 3, name: 'not joined', isActive: true, isInGuild: false, isAvailable: true },
      { instanceNumber: 4, name: 'inactive', isActive: false, isInGuild: true, isAvailable: true },
    ];
    expect(getCopyableBotInfos(bots, 1)).toEqual([bots[1]]);
  });
});
