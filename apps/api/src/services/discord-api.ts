import { logger } from '../infrastructure/logger.js';
import { AppError } from '../infrastructure/app-error.js';
import { config } from '../infrastructure/config.js';

const DISCORD_API_BASE = 'https://discord.com/api/v10';

async function fetchDiscord(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, {
      ...init,
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError('DISCORD_API_ERROR', 'Discord API request timed out', 504);
    }

    throw error;
  }
}

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

/**
 * ユーザーの所属ギルド一覧を取得する
 */
export async function fetchUserGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const response = await fetchDiscord(`${DISCORD_API_BASE}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') ?? '5';
    throw new AppError('RATE_LIMITED', `Discord API rate limited. Retry after ${retryAfter}s`, 429);
  }

  if (response.status === 401) {
    throw new AppError('DISCORD_TOKEN_EXPIRED', 'Discord access token has expired. Please re-login.', 401);
  }
  if (!response.ok) {
    throw new AppError('DISCORD_API_ERROR', `Discord API error: ${response.status}`, response.status);
  }

  return response.json() as Promise<DiscordGuild[]>;
}

/**
 * ユーザーが指定ギルドの ManageGuild 権限を持っているか確認する
 * Discord permissions は bitfield で、ManageGuild は 0x20
 */
export async function hasManageGuildPermission(
  accessToken: string,
  guildId: string,
): Promise<boolean> {
  const guilds = await fetchUserGuilds(accessToken);
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) return false;

  if (guild.owner) return true;

  const permissions = BigInt(guild.permissions);
  const MANAGE_GUILD = BigInt(0x20);
  const ADMINISTRATOR = BigInt(0x8);
  return (permissions & MANAGE_GUILD) !== BigInt(0) || (permissions & ADMINISTRATOR) !== BigInt(0);
}

/**
 * ManageGuild 権限を持つギルドのみフィルタリングして返す
 */
export async function fetchManagedGuilds(accessToken: string): Promise<DiscordGuild[]> {
  const guilds = await fetchUserGuilds(accessToken);
  return guilds.filter((guild) => {
    if (guild.owner) return true;
    const permissions = BigInt(guild.permissions);
    const MANAGE_GUILD = BigInt(0x20);
    const ADMINISTRATOR = BigInt(0x8);
    return (permissions & MANAGE_GUILD) !== BigInt(0) || (permissions & ADMINISTRATOR) !== BigInt(0);
  });
}

export interface DiscordChannel {
  id: string;
  name: string;
  type: number; // 0=テキスト, 2=ボイス, 4=カテゴリ, 13=ステージ
  parent_id: string | null;
  position: number;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

/**
 * Bot トークンでギルドのチャンネル一覧を取得する
 */
export async function fetchGuildChannels(guildId: string): Promise<DiscordChannel[]> {
  if (!config.discordBotToken) {
    throw new AppError('DISCORD_API_ERROR', 'Bot token not configured', 503);
  }
  const response = await fetchDiscord(`${DISCORD_API_BASE}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${config.discordBotToken}` },
  });
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') ?? '5';
    throw new AppError('RATE_LIMITED', `Discord API rate limited. Retry after ${retryAfter}s`, 429);
  }
  if (!response.ok) {
    logger.error({ status: response.status, guildId }, 'Failed to fetch guild channels');
    throw new AppError('DISCORD_API_ERROR', 'Failed to fetch guild channels', 500);
  }
  return response.json() as Promise<DiscordChannel[]>;
}

/**
 * Bot トークンでギルドのロール一覧を取得する
 */
export async function fetchGuildRoles(guildId: string): Promise<DiscordRole[]> {
  if (!config.discordBotToken) {
    throw new AppError('DISCORD_API_ERROR', 'Bot token not configured', 503);
  }
  const response = await fetchDiscord(`${DISCORD_API_BASE}/guilds/${guildId}/roles`, {
    headers: { Authorization: `Bot ${config.discordBotToken}` },
  });
  if (response.status === 429) {
    const retryAfter = response.headers.get('Retry-After') ?? '5';
    throw new AppError('RATE_LIMITED', `Discord API rate limited. Retry after ${retryAfter}s`, 429);
  }
  if (!response.ok) {
    logger.error({ status: response.status, guildId }, 'Failed to fetch guild roles');
    throw new AppError('DISCORD_API_ERROR', 'Failed to fetch guild roles', 500);
  }
  return response.json() as Promise<DiscordRole[]>;
}
