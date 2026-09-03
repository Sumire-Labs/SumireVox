export const REDIS_KEYS = {
  GUILD_SETTINGS: (guildId: string) => `cache:guild-settings:${guildId}`,
  USER_VOICE_SETTING: (userId: string) => `cache:user-voice-setting:${userId}`,
  VC_SESSION: (guildId: string, botInstanceId: number) => `vc-session:${guildId}:${botInstanceId}`,
  SESSION: (sessionId: string) => `session:${sessionId}`,
  BOT_GUILDS: (instanceId: number) => `bot:${instanceId}:guilds`,
  BOT_GUILD_PRESENCE: (instanceId: number, guildId: string) => `bot:${instanceId}:guild:${guildId}:presence`,
  VC_CLAIM: (guildId: string, voiceChannelId: string) => `vc-claim:${guildId}:channel:${voiceChannelId}`,
  BOT_VC_CLAIM: (guildId: string, instanceId: number) => `vc-claim:${guildId}:bot:${instanceId}`,
  VC_ALLOCATION_LOCK: (guildId: string) => `vc-claim:${guildId}:lock`,
  BOT_COMMAND_RESULT: (requestId: string) => `bot-command-result:${requestId}`,
} as const;
