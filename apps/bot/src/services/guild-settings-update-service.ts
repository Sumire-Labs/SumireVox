import {
  GuildSettings,
  REDIS_CHANNELS,
  AutoJoinChannelPair,
  BotInstanceSettings,
  GuildBotInstanceSettingsMap,
  DEFAULT_BOT_INSTANCE_SETTINGS,
  ResolvedBotInstanceSettings,
  AutoJoinSettings,
  ResolvedAutoJoinSettings,
  LIMITS,
  cloneBotInstanceSettings,
  normalizeBotInstanceSettings,
} from '@sumirevox/shared';
import { setCachedGuildSettings, invalidateGuildSettingsCache } from '../infrastructure/settings-cache.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import { getPrisma } from '../infrastructure/database.js';
import { getGuildSettings, mapDbToGuildSettings } from './guild-settings-service.js';
import { getCopyableBotInstances } from './bot-instance-registry.js';
import { logger } from '../infrastructure/logger.js';
import { AppError } from '../infrastructure/app-error.js';

/**
 * サーバー設定を更新する（upsert）
 * DB 更新 → キャッシュ更新 → Pub/Sub 通知
 */
export async function updateGuildSettings(
  guildId: string,
  updates: Partial<Omit<GuildSettings, 'guildId'>>,
): Promise<GuildSettings> {
  const prisma = getPrisma();
  const current = await getGuildSettings(guildId);

  const dbRecord = await prisma.guildSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      ...mapToDbFields({ ...current, ...updates, guildId }),
    },
    update: mapToDbUpdateFields(updates),
  });

  const updated = mapDbToGuildSettings(dbRecord);

  await setCachedGuildSettings(guildId, updated);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));

  return updated;
}

function mapToDbFields(settings: GuildSettings): Record<string, unknown> {
  return {
    maxReadLength: settings.maxReadLength,
    readUsername: settings.readUsername,
    addSanSuffix: settings.addSanSuffix,
    romajiReading: settings.romajiReading,
    uppercaseReading: settings.uppercaseReading,
    joinLeaveNotification: settings.joinLeaveNotification,
    greetingOnJoin: settings.greetingOnJoin,
    customEmojiHandling: settings.customEmojiHandling,
    readTargetType: settings.readTargetType,
    defaultTextChannelId: settings.defaultTextChannelId,
    defaultSpeakerId: settings.defaultSpeakerId,
    adminRoleId: settings.adminRoleId,
    dictionaryPermission: settings.dictionaryPermission,
    manualPremium: settings.manualPremium,
  };
}

/**
 * Bot インスタンス固有の自動接続設定を更新する
 * DB 更新 → キャッシュ無効化 → Pub/Sub 通知
 */
export async function updateBotInstanceSettings(
  guildId: string,
  instanceId: number,
  updates: Partial<BotInstanceSettings>,
): Promise<ResolvedBotInstanceSettings> {
  const prisma = getPrisma();
  const current = await getGuildSettings(guildId);
  const map = getSettingsMap(current.botInstanceSettings);
  const key = String(instanceId);
  const rawExisting = map[key] ?? { ...DEFAULT_BOT_INSTANCE_SETTINGS };
  const existing = normalizeBotInstanceSettings(rawExisting);
  const updated = mergeBotInstanceSettings(rawExisting, existing, updates);
  const newMap: GuildBotInstanceSettingsMap = {
    ...map,
    [key]: toPersistedBotInstanceSettings(updated),
  };

  const jsonMap = newMap as unknown as Parameters<typeof prisma.guildSettings.upsert>[0]['create']['botInstanceSettings'];

  await prisma.guildSettings.upsert({
    where: { guildId },
    create: {
      guildId,
      botInstanceSettings: jsonMap,
      ...(instanceId === 1 ? { autoJoinSettings: toSharedAutoJoinSettings(updated) as unknown as object } : {}),
    },
    update: {
      botInstanceSettings: jsonMap,
      ...(instanceId === 1 ? { autoJoinSettings: toSharedAutoJoinSettings(updated) as unknown as object } : {}),
    },
  });

  await invalidateGuildSettingsCache(guildId);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));

  logger.info({ guildId, instanceId, updates }, 'Bot instance settings updated');
  return updated;
}

function toSharedAutoJoinSettings(settings: ResolvedBotInstanceSettings): ResolvedAutoJoinSettings {
  return { autoJoin: settings.autoJoin, channelPairs: settings.channelPairs.map((pair) => ({ ...pair })) };
}

/** Bot 1の設定UIが使う、全Bot共通の自動接続設定更新。 */
export async function updateAutoJoinSettings(
  guildId: string,
  updates: Partial<AutoJoinSettings>,
): Promise<ResolvedAutoJoinSettings> {
  const current = await getGuildSettings(guildId);
  const existing = normalizeBotInstanceSettings(current.autoJoinSettings ?? current.botInstanceSettings?.['1']);
  const channelPairs = updates.channelPairs === undefined
    ? existing.channelPairs
    : validateChannelPairs(updates.channelPairs);
  const updated: ResolvedAutoJoinSettings = {
    autoJoin: updates.autoJoin ?? existing.autoJoin,
    channelPairs,
  };
  const prisma = getPrisma();
  await prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId, autoJoinSettings: updated as unknown as object },
    update: { autoJoinSettings: updated as unknown as object },
  });
  await invalidateGuildSettingsCache(guildId);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));
  return updated;
}

/**
 * 指定した複数インスタンスへ、自動接続設定だけを完全コピーする。
 * コピー先の既存ペアはマージせず、1回の upsert で上書きする。
 */
export async function copyBotInstanceSettings(
  guildId: string,
  sourceInstanceId: number,
  targetInstanceIds: readonly number[],
): Promise<BotInstanceSettings> {
  const uniqueTargetIds = [...new Set(targetInstanceIds)];
  if (uniqueTargetIds.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'コピー先の Bot を1つ以上選択してください。');
  }
  if (uniqueTargetIds.includes(sourceInstanceId)) {
    throw new AppError('VALIDATION_ERROR', 'コピー元自身には設定をコピーできません。');
  }

  const candidates = await getCopyableBotInstances(guildId, sourceInstanceId);
  const candidateIds = new Set(candidates.map((instance) => instance.instanceId));
  const unavailableIds = uniqueTargetIds.filter((instanceId) => !candidateIds.has(instanceId));
  if (unavailableIds.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'コピー先の Bot が利用できません。設定画面を開き直してください。');
  }

  const prisma = getPrisma();
  const current = await getGuildSettings(guildId);
  const map = getSettingsMap(current.botInstanceSettings);
  const source = cloneBotInstanceSettings(
    getInstanceSettingsForMap(map, sourceInstanceId),
  );
  const persistedSource = toPersistedBotInstanceSettings(source);
  const updatedMap: GuildBotInstanceSettingsMap = { ...map };

  for (const targetInstanceId of uniqueTargetIds) {
    updatedMap[String(targetInstanceId)] = {
      ...persistedSource,
      channelPairs: persistedSource.channelPairs?.map((pair) => ({ ...pair })),
    };
  }

  const jsonMap = updatedMap as unknown as Parameters<typeof prisma.guildSettings.upsert>[0]['create']['botInstanceSettings'];
  await prisma.guildSettings.upsert({
    where: { guildId },
    create: { guildId, botInstanceSettings: jsonMap },
    update: { botInstanceSettings: jsonMap },
  });

  await invalidateGuildSettingsCache(guildId);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));

  logger.info(
    { guildId, sourceInstanceId, targetInstanceIds: uniqueTargetIds },
    'Bot instance auto-join settings copied',
  );

  return persistedSource;
}

function getSettingsMap(value: GuildBotInstanceSettingsMap | undefined): GuildBotInstanceSettingsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function getInstanceSettingsForMap(
  map: GuildBotInstanceSettingsMap,
  instanceId: number,
): ResolvedBotInstanceSettings {
  return normalizeBotInstanceSettings(map[String(instanceId)] ?? DEFAULT_BOT_INSTANCE_SETTINGS);
}

function mergeBotInstanceSettings(
  rawExisting: BotInstanceSettings,
  existing: ResolvedBotInstanceSettings,
  updates: Partial<BotInstanceSettings>,
): ResolvedBotInstanceSettings {
  const autoJoin = updates.autoJoin ?? existing.autoJoin;

  if (updates.channelPairs !== undefined) {
    const channelPairs = validateChannelPairs(updates.channelPairs);
    return {
      autoJoin,
      voiceChannelId: channelPairs[0]?.voiceChannelId ?? null,
      textChannelId: channelPairs[0]?.textChannelId ?? null,
      channelPairs,
    };
  }

  if (Array.isArray(rawExisting.channelPairs)) {
    return {
      ...existing,
      autoJoin,
    };
  }

  const voiceChannelId = updates.voiceChannelId !== undefined
    ? updates.voiceChannelId
    : existing.voiceChannelId;
  const textChannelId = updates.textChannelId !== undefined
    ? updates.textChannelId
    : existing.textChannelId;
  const channelPairs = voiceChannelId && textChannelId
    ? [{ voiceChannelId, textChannelId }]
    : [];

  return {
    autoJoin,
    voiceChannelId,
    textChannelId,
    channelPairs,
  };
}

function validateChannelPairs(value: unknown): AutoJoinChannelPair[] {
  if (!Array.isArray(value)) {
    throw new AppError('VALIDATION_ERROR', '自動接続ペアの形式が不正です。');
  }
  if (value.length > LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS) {
    throw new AppError(
      'VALIDATION_ERROR',
      `自動接続ペアは${LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS}件以内で設定してください。`,
    );
  }

  const seenVoiceChannelIds = new Set<string>();
  return value.map((pair: unknown, index) => {
    if (!isValidChannelPair(pair)) {
      throw new AppError('VALIDATION_ERROR', `自動接続ペア${index + 1}のVC/TCを確認してください。`);
    }
    if (seenVoiceChannelIds.has(pair.voiceChannelId)) {
      throw new AppError('VALIDATION_ERROR', '同じVCを複数の自動接続ペアに登録できません。');
    }
    seenVoiceChannelIds.add(pair.voiceChannelId);
    return {
      voiceChannelId: pair.voiceChannelId,
      textChannelId: pair.textChannelId,
    };
  });
}

function isValidChannelPair(value: unknown): value is AutoJoinChannelPair {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.voiceChannelId === 'string' &&
    record.voiceChannelId.trim().length > 0 &&
    typeof record.textChannelId === 'string' &&
    record.textChannelId.trim().length > 0
  );
}

function toPersistedBotInstanceSettings(
  settings: ResolvedBotInstanceSettings,
): BotInstanceSettings {
  const firstPair = settings.channelPairs[0];
  return {
    autoJoin: settings.autoJoin,
    voiceChannelId: firstPair?.voiceChannelId ?? null,
    textChannelId: firstPair?.textChannelId ?? null,
    channelPairs: settings.channelPairs.map((pair) => ({ ...pair })),
  };
}

function mapToDbUpdateFields(updates: Partial<Omit<GuildSettings, 'guildId'>>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (updates.maxReadLength !== undefined) result.maxReadLength = updates.maxReadLength;
  if (updates.readUsername !== undefined) result.readUsername = updates.readUsername;
  if (updates.addSanSuffix !== undefined) result.addSanSuffix = updates.addSanSuffix;
  if (updates.romajiReading !== undefined) result.romajiReading = updates.romajiReading;
  if (updates.uppercaseReading !== undefined) result.uppercaseReading = updates.uppercaseReading;
  if (updates.joinLeaveNotification !== undefined) result.joinLeaveNotification = updates.joinLeaveNotification;
  if (updates.greetingOnJoin !== undefined) result.greetingOnJoin = updates.greetingOnJoin;
  if (updates.customEmojiHandling !== undefined) result.customEmojiHandling = updates.customEmojiHandling;
  if (updates.readTargetType !== undefined) result.readTargetType = updates.readTargetType;
  if (updates.defaultTextChannelId !== undefined) result.defaultTextChannelId = updates.defaultTextChannelId;
  if (updates.defaultSpeakerId !== undefined) result.defaultSpeakerId = updates.defaultSpeakerId;
  if (updates.adminRoleId !== undefined) result.adminRoleId = updates.adminRoleId;
  if (updates.dictionaryPermission !== undefined) result.dictionaryPermission = updates.dictionaryPermission;
  if (updates.manualPremium !== undefined) result.manualPremium = updates.manualPremium;
  return result;
}
