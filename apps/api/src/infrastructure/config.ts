interface AppConfig {
  nodeEnv: string;
  discordClientId: string;
  discordClientSecret: string;
  discordBotToken: string;
  databaseUrl: string;
  redisUrl: string;
  voicevoxUrls: string[];
  botAdminUserIds: string[];
  apiPort: number;
  sessionSecret: string;
  corsOrigin: string[];
  logLevel: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  stripePriceId: string;
  boostCooldownDays: number;
  apiDomain: string;
  webDomain: string;
  adminDomain: string;
  settingsCacheTtlSeconds: number;
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
    discordClientId: requireEnv('DISCORD_CLIENT_ID'),
    discordClientSecret: requireEnv('DISCORD_CLIENT_SECRET'),
    discordBotToken: process.env['DISCORD_TOKEN_1'] ?? '',
    databaseUrl: requireEnv('DATABASE_URL'),
    voicevoxUrls: (process.env['VOICEVOX_URLS'] ?? 'http://voicevox:50021')
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean),
    redisUrl: requireEnv('REDIS_URL'),
    botAdminUserIds: (process.env['BOT_ADMIN_USER_IDS'] ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    apiPort: requireInt('API_PORT', 3000),
    sessionSecret: requireEnv('SESSION_SECRET'),
    corsOrigin: requireEnv('CORS_ORIGIN')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    logLevel: process.env['LOG_LEVEL'] ?? 'info',
    stripeSecretKey: process.env['STRIPE_SECRET_KEY'] ?? '',
    stripeWebhookSecret: process.env['STRIPE_WEBHOOK_SECRET'] ?? '',
    stripePriceId: process.env['STRIPE_PRICE_ID'] ?? '',
    boostCooldownDays: requireInt('BOOST_COOLDOWN_DAYS', 7),
    apiDomain: process.env['API_DOMAIN'] ?? 'http://localhost:3000',
    webDomain: process.env['WEB_DOMAIN'] ?? 'http://localhost:5173',
    adminDomain: process.env['ADMIN_DOMAIN'] ?? 'http://localhost:5174',
    settingsCacheTtlSeconds: requireInt('SETTINGS_CACHE_TTL_SECONDS', 300),
  };
}

export const config: AppConfig = buildConfig();
