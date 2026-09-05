import type { DiscordGuild } from './discord-api.js';
import { fetchUserGuilds } from './discord-api.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

const USER_GUILDS_CACHE_TTL = 60;
const userGuildsCacheKey = (userId: string) => `user:${userId}:all-guilds`;

const inFlightRequests = new Map<string, Promise<DiscordGuild[]>>();

async function fetchAndCacheUserGuilds(userId: string, accessToken: string): Promise<DiscordGuild[]> {
  const guilds = await fetchUserGuilds(accessToken);

  try {
    await getRedisClient().set(userGuildsCacheKey(userId), JSON.stringify(guilds), 'EX', USER_GUILDS_CACHE_TTL);
  } catch (err) {
    logger.warn({ err }, 'Failed to write user guilds cache');
  }

  return guilds;
}

/**
 * ユーザーの所属ギルド一覧を取得する（Redis キャッシュ・リクエスト重複排除付き）
 */
export async function getUserGuilds(userId: string, accessToken: string): Promise<DiscordGuild[]> {
  const cacheKey = userGuildsCacheKey(userId);

  try {
    const cached = await getRedisClient().get(cacheKey);
    if (cached) return JSON.parse(cached) as DiscordGuild[];
  } catch (err) {
    logger.warn({ err }, 'Failed to read user guilds cache');
  }

  const inFlight = inFlightRequests.get(userId);
  if (inFlight) return inFlight;

  const request = fetchAndCacheUserGuilds(userId, accessToken).finally(() => {
    inFlightRequests.delete(userId);
  });
  inFlightRequests.set(userId, request);
  return request;
}
