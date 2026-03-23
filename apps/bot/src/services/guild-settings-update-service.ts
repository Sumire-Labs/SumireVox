import { GuildSettings, REDIS_CHANNELS } from '@sumirevox/shared';
import { setCachedGuildSettings } from '../infrastructure/settings-cache.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import { getPrisma } from '../infrastructure/database.js';
import { getGuildSettings } from './guild-settings-service.js';

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

  const updated: GuildSettings = {
    guildId: dbRecord.guildId,
    maxReadLength: dbRecord.maxReadLength,
    readUsername: dbRecord.readUsername,
    addSanSuffix: dbRecord.addSanSuffix,
    romajiReading: dbRecord.romajiReading,
    joinLeaveNotification: dbRecord.joinLeaveNotification,
    greetingOnJoin: dbRecord.greetingOnJoin,
    customEmojiHandling: dbRecord.customEmojiHandling as GuildSettings['customEmojiHandling'],
    readTargetType: dbRecord.readTargetType as GuildSettings['readTargetType'],
    autoJoin: dbRecord.autoJoin,
    defaultTextChannelId: dbRecord.defaultTextChannelId,
    defaultSpeakerId: dbRecord.defaultSpeakerId,
    adminRoleId: dbRecord.adminRoleId,
    dictionaryPermission: dbRecord.dictionaryPermission as GuildSettings['dictionaryPermission'],
    manualPremium: dbRecord.manualPremium,
  };

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
    joinLeaveNotification: settings.joinLeaveNotification,
    greetingOnJoin: settings.greetingOnJoin,
    customEmojiHandling: settings.customEmojiHandling,
    readTargetType: settings.readTargetType,
    autoJoin: settings.autoJoin,
    defaultTextChannelId: settings.defaultTextChannelId,
    defaultSpeakerId: settings.defaultSpeakerId,
    adminRoleId: settings.adminRoleId,
    dictionaryPermission: settings.dictionaryPermission,
    manualPremium: settings.manualPremium,
  };
}

function mapToDbUpdateFields(updates: Partial<Omit<GuildSettings, 'guildId'>>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (updates.maxReadLength !== undefined) result.maxReadLength = updates.maxReadLength;
  if (updates.readUsername !== undefined) result.readUsername = updates.readUsername;
  if (updates.addSanSuffix !== undefined) result.addSanSuffix = updates.addSanSuffix;
  if (updates.romajiReading !== undefined) result.romajiReading = updates.romajiReading;
  if (updates.joinLeaveNotification !== undefined) result.joinLeaveNotification = updates.joinLeaveNotification;
  if (updates.greetingOnJoin !== undefined) result.greetingOnJoin = updates.greetingOnJoin;
  if (updates.customEmojiHandling !== undefined) result.customEmojiHandling = updates.customEmojiHandling;
  if (updates.readTargetType !== undefined) result.readTargetType = updates.readTargetType;
  if (updates.autoJoin !== undefined) result.autoJoin = updates.autoJoin;
  if (updates.defaultTextChannelId !== undefined) result.defaultTextChannelId = updates.defaultTextChannelId;
  if (updates.defaultSpeakerId !== undefined) result.defaultSpeakerId = updates.defaultSpeakerId;
  if (updates.adminRoleId !== undefined) result.adminRoleId = updates.adminRoleId;
  if (updates.dictionaryPermission !== undefined) result.dictionaryPermission = updates.dictionaryPermission;
  if (updates.manualPremium !== undefined) result.manualPremium = updates.manualPremium;
  return result;
}
