export const REDIS_KEYS = {
  GUILD_SETTINGS: (guildId: string) => `cache:guild-settings:${guildId}`,
  USER_VOICE_SETTING: (userId: string) => `cache:user-voice-setting:${userId}`,
  VC_SESSION: (guildId: string) => `vc-session:${guildId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
} as const;
