import { requireEnv, requireInt } from '@sumirevox/shared';

interface AppConfig {
  nodeEnv: string;
  botInstanceId: number;
  discordToken: string;
  discordClientId: string;
  databaseUrl: string;
  redisUrl: string;
  voicevoxUrls: string[];
  defaultSpeakerId: number;
  maxConcurrentSynthesisPerGuild: number;
  maxConcurrentSynthesisGlobal: number;
  healthCheckIntervalSeconds: number;
  voiceDisconnectTimeoutSeconds: number;
  settingsCacheTtlSeconds: number;
  botAdminUserIds: string[];
  globalDictNotificationChannelId: string;
  deployGuildId: string | undefined;
  logLevel: string;
}

function buildConfig(): AppConfig {
  const botInstanceId = requireInt('BOT_INSTANCE_ID', 1);

  const discordTokenKey = `DISCORD_TOKEN_${botInstanceId}`;
  const discordToken = requireEnv(discordTokenKey);

  const discordClientIdKey = `DISCORD_CLIENT_ID_${botInstanceId}`;
  const discordClientId = requireEnv(discordClientIdKey);

  return {
    nodeEnv: process.env['NODE_ENV'] ?? 'production',
    botInstanceId,
    discordToken,
    discordClientId,
    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: requireEnv('REDIS_URL'),
    voicevoxUrls: (process.env['VOICEVOX_URLS'] ?? 'http://voicevox:50021')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean),
    defaultSpeakerId: requireInt('DEFAULT_SPEAKER_ID', 1),
    maxConcurrentSynthesisPerGuild: requireInt('MAX_CONCURRENT_SYNTHESIS_PER_GUILD', 3),
    maxConcurrentSynthesisGlobal: requireInt('MAX_CONCURRENT_SYNTHESIS_GLOBAL', 10),
    healthCheckIntervalSeconds: requireInt('HEALTH_CHECK_INTERVAL_SECONDS', 30),
    voiceDisconnectTimeoutSeconds: requireInt('VOICE_DISCONNECT_TIMEOUT_SECONDS', 300),
    settingsCacheTtlSeconds: requireInt('SETTINGS_CACHE_TTL_SECONDS', 300),
    botAdminUserIds: (process.env['BOT_ADMIN_USER_IDS'] ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    globalDictNotificationChannelId: process.env['GLOBAL_DICT_NOTIFICATION_CHANNEL_ID'] ?? '',
    deployGuildId: process.env['DEPLOY_GUILD_ID'] || undefined,
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
  };
}

export const config: AppConfig = buildConfig();
