import type {
  AutoJoinChannelPair,
  AutoJoinSettings,
  ResolvedAutoJoinSettings,
} from '@sumirevox/shared';

export function createEmptyAutoJoinSettings(): ResolvedAutoJoinSettings {
  return {
    autoJoin: false,
    channelPairs: [],
  };
}

export function canAddChannelPair(
  pairs: readonly AutoJoinChannelPair[],
  pair: Partial<AutoJoinChannelPair>,
): pair is AutoJoinChannelPair {
  if (!pair.voiceChannelId || !pair.textChannelId) return false;
  return !pairs.some((current) => current.voiceChannelId === pair.voiceChannelId);
}

export function appendChannelPair(
  pairs: readonly AutoJoinChannelPair[],
  pair: Partial<AutoJoinChannelPair>,
): AutoJoinChannelPair[] | null {
  if (!canAddChannelPair(pairs, pair)) return null;
  return [...pairs.map((current) => ({ ...current })), {
    voiceChannelId: pair.voiceChannelId,
    textChannelId: pair.textChannelId,
  }];
}

export function updateChannelPair(
  pairs: readonly AutoJoinChannelPair[],
  index: number,
  update: Partial<AutoJoinChannelPair>,
): AutoJoinChannelPair[] {
  return pairs.map((pair, pairIndex) => (
    pairIndex === index
      ? {
          voiceChannelId: update.voiceChannelId ?? pair.voiceChannelId,
          textChannelId: update.textChannelId ?? pair.textChannelId,
        }
      : { ...pair }
  ));
}

export function removeChannelPair(
  pairs: readonly AutoJoinChannelPair[],
  index: number,
): AutoJoinChannelPair[] {
  return pairs.filter((_, pairIndex) => pairIndex !== index).map((pair) => ({ ...pair }));
}

export function getAvailableVoiceChannelIds(
  pairs: readonly AutoJoinChannelPair[],
): Set<string> {
  return new Set(pairs.map((pair) => pair.voiceChannelId));
}

export function applyChannelPairs(
  settings: ResolvedAutoJoinSettings,
  channelPairs: readonly AutoJoinChannelPair[],
): ResolvedAutoJoinSettings {
  const nextPairs = channelPairs.map((pair) => ({ ...pair }));
  return {
    autoJoin: settings.autoJoin,
    channelPairs: nextPairs,
  };
}

export function applyAutoJoinSettingsPatch(
  settings: ResolvedAutoJoinSettings,
  patch: Partial<AutoJoinSettings>,
): ResolvedAutoJoinSettings {
  if (patch.channelPairs !== undefined) {
    return applyChannelPairs(
      { ...settings, autoJoin: patch.autoJoin ?? settings.autoJoin },
      patch.channelPairs,
    );
  }

  return {
    ...settings,
    ...patch,
    channelPairs: settings.channelPairs.map((pair) => ({ ...pair })),
  };
}
