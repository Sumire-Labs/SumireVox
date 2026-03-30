import { GuildSettings, GUILD_SETTINGS_DEFAULTS, REDIS_CHANNELS } from '@sumirevox/shared';
import { getCachedGuildSettings, setCachedGuildSettings } from '../infrastructure/settings-cache.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import { getPrisma } from '../infrastructure/database.js';
import { logger } from '../infrastructure/logger.js';

type DbGuildSettings = {
  guildId: string;
  maxReadLength: number;
  readUsername: boolean;
  addSanSuffix: boolean;
  romajiReading: boolean;
  uppercaseReading: boolean;
  joinLeaveNotification: boolean;
  greetingOnJoin: boolean;
  customEmojiHandling: string;
  readTargetType: string;
  defaultTextChannelId: string | null;
  defaultSpeakerId: number | null;
  adminRoleId: string | null;
  dictionaryPermission: string;
  manualPremium: boolean;
};

export function mapDbToGuildSettings(db: DbGuildSettings): GuildSettings {
  return {
    guildId: db.guildId,
    maxReadLength: db.maxReadLength,
    readUsername: db.readUsername,
    addSanSuffix: db.addSanSuffix,
    romajiReading: db.romajiReading,
    uppercaseReading: db.uppercaseReading,
    joinLeaveNotification: db.joinLeaveNotification,
    greetingOnJoin: db.greetingOnJoin,
    customEmojiHandling: db.customEmojiHandling as GuildSettings['customEmojiHandling'],
    readTargetType: db.readTargetType as GuildSettings['readTargetType'],
    defaultTextChannelId: db.defaultTextChannelId,
    defaultSpeakerId: db.defaultSpeakerId,
    adminRoleId: db.adminRoleId,
    dictionaryPermission: db.dictionaryPermission as GuildSettings['dictionaryPermission'],
    manualPremium: db.manualPremium,
  };
}

function buildUpdateFields(
  updates: Partial<Omit<GuildSettings, 'guildId'>>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * サーバー設定を取得する
 */
export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  const cached = await getCachedGuildSettings(guildId);
  if (cached) return cached;

  const prisma = getPrisma();
  const dbSettings = await prisma.guildSettings.findUnique({ where: { guildId } });

  if (dbSettings) {
    const settings = mapDbToGuildSettings(dbSettings);
    await setCachedGuildSettings(guildId, settings);
    return settings;
  }

  const defaults: GuildSettings = { guildId, ...GUILD_SETTINGS_DEFAULTS };
  await setCachedGuildSettings(guildId, defaults);
  return defaults;
}

/**
 * サーバー設定を更新する（upsert）
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
      maxReadLength: updates.maxReadLength ?? current.maxReadLength,
      readUsername: updates.readUsername ?? current.readUsername,
      addSanSuffix: updates.addSanSuffix ?? current.addSanSuffix,
      romajiReading: updates.romajiReading ?? current.romajiReading,
      uppercaseReading: updates.uppercaseReading ?? current.uppercaseReading,
      joinLeaveNotification: updates.joinLeaveNotification ?? current.joinLeaveNotification,
      greetingOnJoin: updates.greetingOnJoin ?? current.greetingOnJoin,
      customEmojiHandling: updates.customEmojiHandling ?? current.customEmojiHandling,
      readTargetType: updates.readTargetType ?? current.readTargetType,
      defaultTextChannelId: updates.defaultTextChannelId ?? current.defaultTextChannelId,
      defaultSpeakerId: updates.defaultSpeakerId ?? current.defaultSpeakerId,
      adminRoleId: updates.adminRoleId ?? current.adminRoleId,
      dictionaryPermission: updates.dictionaryPermission ?? current.dictionaryPermission,
      manualPremium: updates.manualPremium ?? current.manualPremium,
    },
    update: buildUpdateFields(updates),
  });

  const updated = mapDbToGuildSettings(dbRecord);
  await setCachedGuildSettings(guildId, updated);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));
  logger.info({ guildId }, 'Guild settings updated via API');

  return updated;
}
