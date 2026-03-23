import { REDIS_CHANNELS } from '@sumirevox/shared';
import { invalidateGuildSettingsCache, invalidateUserVoiceSettingCache } from '../infrastructure/settings-cache.js';
import { invalidateGuildTrie, invalidateAllTries } from './text-pipeline/index.js';
import { logger } from '../infrastructure/logger.js';

/**
 * Bot 用の Pub/Sub ハンドラを返す
 * setupPubSub に渡す handlers オブジェクト
 */
export function createBotPubSubHandlers(): Record<string, (message: string) => void> {
  return {
    [REDIS_CHANNELS.GUILD_SETTINGS_UPDATED]: (message: string) => {
      try {
        const { guildId } = JSON.parse(message) as { guildId?: string };
        if (guildId) {
          invalidateGuildSettingsCache(guildId).catch(() => {});
          logger.debug({ guildId }, 'Guild settings cache invalidated via Pub/Sub');
        }
      } catch (error) {
        logger.error({ err: error }, 'Error handling guild settings Pub/Sub');
      }
    },
    [REDIS_CHANNELS.USER_VOICE_SETTING_UPDATED]: (message: string) => {
      try {
        const { userId } = JSON.parse(message) as { userId?: string };
        if (userId) {
          invalidateUserVoiceSettingCache(userId).catch(() => {});
          logger.debug({ userId }, 'User voice setting cache invalidated via Pub/Sub');
        }
      } catch (error) {
        logger.error({ err: error }, 'Error handling user voice setting Pub/Sub');
      }
    },
    [REDIS_CHANNELS.SERVER_DICTIONARY_UPDATED]: (message: string) => {
      try {
        const { guildId } = JSON.parse(message) as { guildId?: string };
        if (guildId) {
          invalidateGuildTrie(guildId);
          logger.debug({ guildId }, 'Server dictionary trie invalidated via Pub/Sub');
        }
      } catch (error) {
        logger.error({ err: error }, 'Error handling server dictionary Pub/Sub');
      }
    },
    [REDIS_CHANNELS.GLOBAL_DICTIONARY_UPDATED]: (_message: string) => {
      invalidateAllTries();
      logger.debug('All dictionary tries invalidated via Pub/Sub');
    },
  };
}
