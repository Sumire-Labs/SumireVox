export const REDIS_KEYS = {
  GUILD_SETTINGS: (guildId: string) => `cache:guild-settings:${guildId}`,
  USER_VOICE_SETTING: (userId: string) => `cache:user-voice-setting:${userId}`,
  VC_SESSION: (guildId: string, botInstanceId: number) => `vc-session:${guildId}:${botInstanceId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  BOT_GUILDS: (instanceId: number) => `bot:${instanceId}:guilds`,
} as const;
