interface AppConfig {
  nodeEnv: string;
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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[config] Required environment variable "${name}" is not set. Exiting.`);
    process.exit(1);
  }
  return value;
}

function requireInt(name: string, defaultValue?: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    if (defaultValue !== undefined) return defaultValue;
    console.error(`[config] Required environment variable "${name}" is not set. Exiting.`);
    process.exit(1);
  }
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    console.error(`[config] Environment variable "${name}" must be an integer, got: "${raw}". Exiting.`);
    process.exit(1);
  }
  return parsed;
}

function buildConfig(): AppConfig {
  return {
    nodeEnv: process.env['NODE_ENV'] ?? 'production',
    discordToken: requireEnv('DISCORD_TOKEN'),
    discordClientId: requireEnv('DISCORD_CLIENT_ID'),
    databaseUrl: requireEnv('DATABASE_URL'),
    redisUrl: requireEnv('REDIS_URL'),
    voicevoxUrls: (process.env['VOICEVOX_URLS'] ?? 'http://voicevox:50021')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean),
    defaultSpeakerId: requireInt('DEFAULT_SPEAKER_ID'),
    maxConcurrentSynthesisPerGuild: requireInt('MAX_CONCURRENT_SYNTHESIS_PER_GUILD', 3),
    maxConcurrentSynthesisGlobal: requireInt('MAX_CONCURRENT_SYNTHESIS_GLOBAL', 10),
    healthCheckIntervalSeconds: requireInt('HEALTH_CHECK_INTERVAL_SECONDS'),
    voiceDisconnectTimeoutSeconds: requireInt('VOICE_DISCONNECT_TIMEOUT_SECONDS'),
    settingsCacheTtlSeconds: requireInt('SETTINGS_CACHE_TTL_SECONDS'),
    botAdminUserIds: requireEnv('BOT_ADMIN_USER_IDS')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    globalDictNotificationChannelId: requireEnv('GLOBAL_DICT_NOTIFICATION_CHANNEL_ID'),
    deployGuildId: process.env['DEPLOY_GUILD_ID'] || undefined,
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
  };
}

export const config: AppConfig = buildConfig();
