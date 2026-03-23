import { GuildSettings, UserVoiceSetting } from '@sumirevox/shared';
import { REDIS_KEYS } from '@sumirevox/shared';
import { config } from './config.js';
import { logger } from './logger.js';
import { getRedisClient } from './redis.js';

export async function getCachedGuildSettings(guildId: string): Promise<GuildSettings | null> {
  try {
    const value = await getRedisClient().get(REDIS_KEYS.GUILD_SETTINGS(guildId));
    if (!value) return null;
    return JSON.parse(value) as GuildSettings;
  } catch (err) {
    logger.error({ err }, 'Failed to get cached guild settings');
    return null;
  }
}

export async function setCachedGuildSettings(guildId: string, settings: GuildSettings): Promise<void> {
  try {
    await getRedisClient().set(
      REDIS_KEYS.GUILD_SETTINGS(guildId),
      JSON.stringify(settings),
      'EX',
      config.settingsCacheTtlSeconds,
    );
  } catch (err) {
    logger.error({ err }, 'Failed to set cached guild settings');
  }
}

export async function invalidateGuildSettingsCache(guildId: string): Promise<void> {
  try {
    await getRedisClient().del(REDIS_KEYS.GUILD_SETTINGS(guildId));
  } catch (err) {
    logger.error({ err }, 'Failed to invalidate guild settings cache');
  }
}

export async function getCachedUserVoiceSetting(userId: string): Promise<UserVoiceSetting | null> {
  try {
    const value = await getRedisClient().get(REDIS_KEYS.USER_VOICE_SETTING(userId));
    if (!value) return null;
    return JSON.parse(value) as UserVoiceSetting;
  } catch (err) {
    logger.error({ err }, 'Failed to get cached user voice setting');
    return null;
  }
}

export async function setCachedUserVoiceSetting(userId: string, setting: UserVoiceSetting): Promise<void> {
  try {
    await getRedisClient().set(
      REDIS_KEYS.USER_VOICE_SETTING(userId),
      JSON.stringify(setting),
      'EX',
      config.settingsCacheTtlSeconds,
    );
  } catch (err) {
    logger.error({ err }, 'Failed to set cached user voice setting');
  }
}

export async function invalidateUserVoiceSettingCache(userId: string): Promise<void> {
  try {
    await getRedisClient().del(REDIS_KEYS.USER_VOICE_SETTING(userId));
  } catch (err) {
    logger.error({ err }, 'Failed to invalidate user voice setting cache');
  }
}
