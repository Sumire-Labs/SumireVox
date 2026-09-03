import { fetchGuildChannels } from './discord-api.js';
import type { DiscordChannel } from './discord-api.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { AppError } from '../infrastructure/app-error.js';
import { config } from '../infrastructure/config.js';
import { getActiveBotInstances, isBotInGuild } from './bot-instance-service.js';

const CHANNEL_CACHE_TTL = 120;
const channelCacheKey = (guildId: string) => `guild:${guildId}:channels:v2`;

const DISCORD_CHANNEL_TYPES = {
  GuildText: 0,
  GuildVoice: 2,
  GuildCategory: 4,
  GuildAnnouncement: 5,
  GuildStageVoice: 13,
} as const;

type GuildChannelSemanticType = 'text' | 'announcement' | 'voice' | 'stage';

const DISCORD_READABLE_CHANNEL_TYPES = new Map<number, GuildChannelSemanticType>([
  [DISCORD_CHANNEL_TYPES.GuildText, 'text'],
  [DISCORD_CHANNEL_TYPES.GuildAnnouncement, 'announcement'],
  [DISCORD_CHANNEL_TYPES.GuildVoice, 'voice'],
  [DISCORD_CHANNEL_TYPES.GuildStageVoice, 'stage'],
]);

export interface GuildChannelCategory {
  id: string;
  name: string;
}

export interface GuildChannelItem {
  id: string;
  name: string;
  parentId: string | null;
  type: GuildChannelSemanticType;
}

export interface GuildChannelsSorted {
  textChannels: GuildChannelItem[];
  voiceChannels: GuildChannelItem[];
  readableChannels: GuildChannelItem[];
  categories: GuildChannelCategory[];
}

function toGuildChannelItem(channel: DiscordChannel, type: GuildChannelSemanticType): GuildChannelItem {
  return { id: channel.id, name: channel.name, parentId: channel.parent_id, type };
}

export async function getGuildChannelsSorted(guildId: string): Promise<GuildChannelsSorted> {
  const redis = getRedisClient();
  const cacheKey = channelCacheKey(guildId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as GuildChannelsSorted;
  }

  const botToken = await getGuildChannelAccessToken(guildId);
  const channels = await fetchGuildChannels(guildId, botToken);

  const categories = channels
    .filter((ch) => ch.type === DISCORD_CHANNEL_TYPES.GuildCategory)
    .sort((a, b) => a.position - b.position)
    .map((ch) => ({ id: ch.id, name: ch.name }));

  const readableChannels = channels
    .flatMap((channel) => {
      const type = DISCORD_READABLE_CHANNEL_TYPES.get(channel.type);
      return type === undefined ? [] : [{ channel, type }];
    })
    .sort((a, b) => a.channel.position - b.channel.position)
    .map(({ channel, type }) => toGuildChannelItem(channel, type));

  const textChannels = readableChannels.filter((channel) => channel.type === 'text');
  const voiceChannels = readableChannels.filter((channel) => channel.type === 'voice' || channel.type === 'stage');

  const result = { textChannels, voiceChannels, readableChannels, categories };
  await redis.set(cacheKey, JSON.stringify(result), 'EX', CHANNEL_CACHE_TTL);

  return result;
}

async function getGuildChannelAccessToken(guildId: string): Promise<string> {
  const instances = await getActiveBotInstances();

  for (const instance of instances) {
    const botToken = config.discordBotTokens.get(instance.instanceId);
    if (!botToken) continue;

    if (await isBotInGuild(instance.instanceId, guildId)) {
      return botToken;
    }
  }

  throw new AppError(
    'SERVICE_UNAVAILABLE',
    'チャンネル一覧を取得できる参加中の Bot が見つかりません。',
    503,
  );
}
