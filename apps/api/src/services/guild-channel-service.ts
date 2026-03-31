import { fetchGuildChannels } from './discord-api.js';
import { getRedisClient } from '../infrastructure/redis.js';

const CHANNEL_CACHE_TTL = 120;
const channelCacheKey = (guildId: string) => `guild:${guildId}:channels`;

export interface GuildChannelCategory {
  id: string;
  name: string;
}

export interface GuildChannelItem {
  id: string;
  name: string;
  parentId: string | null;
}

export interface GuildChannelsSorted {
  textChannels: GuildChannelItem[];
  voiceChannels: GuildChannelItem[];
  categories: GuildChannelCategory[];
}

export async function getGuildChannelsSorted(guildId: string): Promise<GuildChannelsSorted> {
  const redis = getRedisClient();
  const cacheKey = channelCacheKey(guildId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as GuildChannelsSorted;
  }

  const channels = await fetchGuildChannels(guildId);

  const categories = channels
    .filter((ch) => ch.type === 4)
    .sort((a, b) => a.position - b.position)
    .map((ch) => ({ id: ch.id, name: ch.name }));

  const textChannels = channels
    .filter((ch) => ch.type === 0)
    .sort((a, b) => a.position - b.position)
    .map((ch) => ({ id: ch.id, name: ch.name, parentId: ch.parent_id }));

  const voiceChannels = channels
    .filter((ch) => ch.type === 2 || ch.type === 13)
    .sort((a, b) => a.position - b.position)
    .map((ch) => ({ id: ch.id, name: ch.name, parentId: ch.parent_id }));

  const result = { textChannels, voiceChannels, categories };
  await redis.set(cacheKey, JSON.stringify(result), 'EX', CHANNEL_CACHE_TTL);

  return result;
}
