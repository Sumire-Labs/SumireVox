export const REDIS_CHANNELS = {
  GUILD_SETTINGS_UPDATED: 'guild:settings:updated',
  GUILD_PREMIUM_UPDATED: 'guild:premium:updated',
  USER_VOICE_SETTING_UPDATED: 'user:voice-setting:updated',
  SERVER_DICTIONARY_UPDATED: 'server:dictionary:updated',
  GLOBAL_DICTIONARY_UPDATED: 'global:dictionary:updated',
  BOT_INSTANCE_COMMAND: (instanceId: number) => `bot:instance:${instanceId}:command`,
} as const;
