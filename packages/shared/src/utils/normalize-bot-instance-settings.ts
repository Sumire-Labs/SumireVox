import type {
  AutoJoinChannelPair,
  BotInstanceSettings,
  ResolvedBotInstanceSettings,
  AutoJoinSettings,
  ResolvedAutoJoinSettings,
} from '../types/bot-instance.js';
import { LIMITS } from '../constants/limits.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function isAutoJoinChannelPair(value: unknown): value is AutoJoinChannelPair {
  if (!isRecord(value)) return false;
  return (
    typeof value.voiceChannelId === 'string' &&
    value.voiceChannelId.length > 0 &&
    typeof value.textChannelId === 'string' &&
    value.textChannelId.length > 0
  );
}

function normalizeChannelPairs(values: readonly unknown[]): AutoJoinChannelPair[] {
  const seenVoiceChannelIds = new Set<string>();
  const pairs: AutoJoinChannelPair[] = [];

  for (const value of values) {
    if (!isAutoJoinChannelPair(value) || seenVoiceChannelIds.has(value.voiceChannelId)) {
      continue;
    }

    seenVoiceChannelIds.add(value.voiceChannelId);
    pairs.push({
      voiceChannelId: value.voiceChannelId,
      textChannelId: value.textChannelId,
    });
  }

  return pairs.slice(0, LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS);
}

/**
 * 旧形式を含む Bot インスタンス設定を、常に channelPairs を持つ形へ変換する。
 * channelPairs が配列として保存されている場合はそれを優先し、旧形式へは戻らない。
 */
export function normalizeBotInstanceSettings(value: unknown): ResolvedBotInstanceSettings {
  const record = isRecord(value) ? value : {};
  const autoJoin = typeof record.autoJoin === 'boolean' ? record.autoJoin : false;
  const voiceChannelId = readNullableString(record.voiceChannelId);
  const textChannelId = readNullableString(record.textChannelId);

  const channelPairs = Array.isArray(record.channelPairs)
    ? normalizeChannelPairs(record.channelPairs)
    : voiceChannelId && textChannelId
      ? [{ voiceChannelId, textChannelId }]
      : [];
  return {
    autoJoin,
    voiceChannelId,
    textChannelId,
    channelPairs,
  } satisfies ResolvedBotInstanceSettings;
}

/** 正規化済み設定を DB 保存用の独立した値へ複製する。 */
export function cloneBotInstanceSettings(
  settings: ResolvedBotInstanceSettings | BotInstanceSettings,
): ResolvedBotInstanceSettings {
  return normalizeBotInstanceSettings({
    ...settings,
    channelPairs: settings.channelPairs?.map((pair) => ({ ...pair })),
  });
}

/** 共有自動接続設定を正規化する。旧インスタンス設定と同じ入力許容規則を使う。 */
export function normalizeAutoJoinSettings(value: unknown): ResolvedAutoJoinSettings {
  const normalized = normalizeBotInstanceSettings(value);
  return {
    autoJoin: normalized.autoJoin,
    channelPairs: normalized.channelPairs.map((pair) => ({ ...pair })),
  };
}

export function cloneAutoJoinSettings(
  settings: ResolvedAutoJoinSettings | AutoJoinSettings,
): ResolvedAutoJoinSettings {
  return normalizeAutoJoinSettings({
    ...settings,
    channelPairs: settings.channelPairs?.map((pair) => ({ ...pair })),
  });
}
