import type {
  AutoJoinChannelPair,
  BotInstanceSettings,
  ResolvedBotInstanceSettings,
} from '@sumirevox/shared';

export interface CopyableBotInfo {
  instanceNumber: number;
  isActive: boolean;
  isInGuild: boolean;
}

export function createEmptyBotInstanceSettings(): ResolvedBotInstanceSettings {
  return {
    autoJoin: false,
    textChannelId: null,
    voiceChannelId: null,
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
  settings: ResolvedBotInstanceSettings,
  channelPairs: readonly AutoJoinChannelPair[],
): ResolvedBotInstanceSettings {
  const nextPairs = channelPairs.map((pair) => ({ ...pair }));
  return {
    autoJoin: settings.autoJoin,
    voiceChannelId: nextPairs[0]?.voiceChannelId ?? null,
    textChannelId: nextPairs[0]?.textChannelId ?? null,
    channelPairs: nextPairs,
  };
}

export function applyBotSettingsPatch(
  settings: ResolvedBotInstanceSettings,
  patch: Partial<BotInstanceSettings>,
): ResolvedBotInstanceSettings {
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

export function getCopyableBotInfos<T extends CopyableBotInfo>(
  bots: readonly T[],
  sourceInstanceId: number,
): T[] {
  return bots.filter(
    (bot) =>
      bot.instanceNumber !== sourceInstanceId &&
      bot.isActive &&
      bot.isInGuild,
  );
}
