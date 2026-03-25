import { config } from './config.js';
import { getRedisClient } from './redis.js';
import { logger } from './logger.js';

interface DiscordGuildInfo {
  name: string;
  icon: string | null;
}

const CACHE_TTL = 300;
const CACHE_KEY_PREFIX = 'admin:guild:info:';

export async function getGuildInfo(guildId: string): Promise<DiscordGuildInfo> {
  const redis = getRedisClient();
  const cacheKey = `${CACHE_KEY_PREFIX}${guildId}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as DiscordGuildInfo;
  }

  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, {
      headers: { Authorization: `Bot ${config.discordBotToken}` },
    });

    if (!res.ok) {
      throw new Error(`Discord API returned ${res.status}`);
    }

    const data = (await res.json()) as { name: string; icon: string | null };
    const info: DiscordGuildInfo = { name: data.name, icon: data.icon ?? null };

    await redis.set(cacheKey, JSON.stringify(info), 'EX', CACHE_TTL);
    return info;
  } catch (err) {
    logger.warn({ err, guildId }, 'Failed to fetch guild info from Discord API');
    return { name: '不明なサーバー', icon: null };
  }
}
