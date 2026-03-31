import { fetchGuildRoles } from './discord-api.js';
import { getRedisClient } from '../infrastructure/redis.js';

const ROLE_CACHE_TTL = 120;
const roleCacheKey = (guildId: string) => `guild:${guildId}:roles`;

export interface GuildRoleItem {
  id: string;
  name: string;
  color: number;
}

export async function getGuildRolesSorted(guildId: string): Promise<GuildRoleItem[]> {
  const redis = getRedisClient();
  const cacheKey = roleCacheKey(guildId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as GuildRoleItem[];
  }

  const roles = await fetchGuildRoles(guildId);

  const result = roles
    .filter((r) => r.name !== '@everyone' && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.color }));

  await redis.set(cacheKey, JSON.stringify(result), 'EX', ROLE_CACHE_TTL);

  return result;
}
