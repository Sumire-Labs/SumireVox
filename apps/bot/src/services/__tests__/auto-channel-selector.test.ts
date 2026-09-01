import { describe, expect, it } from 'vitest';
import {
  countHumanMembers,
  rankAutoJoinCandidates,
} from '../auto-channel-selector.js';

describe('auto-channel-selector', () => {
  it('Botを除いた人数を数える', () => {
    const members = [
      { user: { bot: false } },
      { user: { bot: true } },
      { user: { bot: false } },
    ];

    expect(countHumanMembers(members)).toBe(2);
  });

  it('人数降順、同数時は設定順で候補を並べる', () => {
    const candidates = [
      { pair: { voiceChannelId: 'voice-1', textChannelId: 'text-1' }, order: 0, humanMemberCount: 2 },
      { pair: { voiceChannelId: 'voice-2', textChannelId: 'text-2' }, order: 1, humanMemberCount: 3 },
      { pair: { voiceChannelId: 'voice-3', textChannelId: 'text-3' }, order: 2, humanMemberCount: 3 },
    ];

    expect(rankAutoJoinCandidates(candidates).map((candidate) => candidate.pair.voiceChannelId)).toEqual([
      'voice-2',
      'voice-3',
      'voice-1',
    ]);
    expect(candidates.map((candidate) => candidate.pair.voiceChannelId)).toEqual([
      'voice-1',
      'voice-2',
      'voice-3',
    ]);
  });
});
