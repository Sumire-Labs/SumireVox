import {
  GuildSettings,
  GUILD_SETTINGS_DEFAULTS,
  BotInstanceSettings,
  GuildBotInstanceSettingsMap,
  DEFAULT_BOT_INSTANCE_SETTINGS,
} from '@sumirevox/shared';
import { GuildSettings as PrismaGuildSettings } from '@prisma/client';
import { getCachedGuildSettings, setCachedGuildSettings } from '../infrastructure/settings-cache.js';
import { getPrisma } from '../infrastructure/database.js';

/**
 * サーバー設定を取得する
 * 優先順位: Redis キャッシュ → DB → デフォルト値（DB に未登録の場合）
 */
export async function getGuildSettings(guildId: string): Promise<GuildSettings> {
  // 1. Redis キャッシュ
  const cached = await getCachedGuildSettings(guildId);
  if (cached) return cached;

  // 2. DB
  const prisma = getPrisma();
  const dbSettings = await prisma.guildSettings.findUnique({
    where: { guildId },
  });

  if (dbSettings) {
    const settings = mapDbToGuildSettings(dbSettings);
    await setCachedGuildSettings(guildId, settings);
    return settings;
  }

  // 3. デフォルト値（DB に未登録 → 初アクセス）
  const defaults: GuildSettings = {
    guildId,
    ...GUILD_SETTINGS_DEFAULTS,
  };
  await setCachedGuildSettings(guildId, defaults);
  return defaults;
}

function mapDbToGuildSettings(db: PrismaGuildSettings): GuildSettings {
  return {
    guildId: db.guildId,
    maxReadLength: db.maxReadLength,
    readUsername: db.readUsername,
    addSanSuffix: db.addSanSuffix,
    romajiReading: db.romajiReading,
    joinLeaveNotification: db.joinLeaveNotification,
    greetingOnJoin: db.greetingOnJoin,
    customEmojiHandling: db.customEmojiHandling as GuildSettings['customEmojiHandling'],
    readTargetType: db.readTargetType as GuildSettings['readTargetType'],
    autoJoin: db.autoJoin,
    defaultTextChannelId: db.defaultTextChannelId,
    defaultSpeakerId: db.defaultSpeakerId,
    adminRoleId: db.adminRoleId,
    dictionaryPermission: db.dictionaryPermission as GuildSettings['dictionaryPermission'],
    manualPremium: db.manualPremium,
    botInstanceSettings: ((db.botInstanceSettings ?? {}) as unknown) as GuildBotInstanceSettingsMap,
  };
}

/**
 * サーバー設定から特定の Bot インスタンスの設定を取得する
 */
export function getInstanceSettings(guildSettings: GuildSettings, instanceId: number): BotInstanceSettings {
  const map = (guildSettings.botInstanceSettings ?? {}) as GuildBotInstanceSettingsMap;
  return map[String(instanceId)] ?? { ...DEFAULT_BOT_INSTANCE_SETTINGS };
}
