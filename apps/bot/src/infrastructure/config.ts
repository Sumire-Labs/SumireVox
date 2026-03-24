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
  const botInstanceId = parseInt(process.env['BOT_INSTANCE_ID'] ?? '1', 10);

  const discordTokenKey = `DISCORD_TOKEN_${botInstanceId}`;
  const discordToken = process.env[discordTokenKey];
  if (!discordToken) {
    console.error(`[config] Required environment variable "${discordTokenKey}" is not set. Exiting.`);
    process.exit(1);
  }

  const discordClientIdKey = `DISCORD_CLIENT_ID_${botInstanceId}`;
  const discordClientId = process.env[discordClientIdKey];
  if (!discordClientId) {
    console.error(`[config] Required environment variable "${discordClientIdKey}" is not set. Exiting.`);
    process.exit(1);
  }

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
