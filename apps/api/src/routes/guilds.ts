import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { requireGuildAdmin, guildAdminCacheKey } from '../middleware/require-guild-admin.js';
import { fetchManagedGuilds, fetchGuildChannels, fetchGuildRoles } from '../services/discord-api.js';
import { getGuildSettings, updateGuildSettings } from '../services/guild-settings-service.js';
import { AppError } from '../infrastructure/app-error.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';
import { config } from '../infrastructure/config.js';

const GUILD_CACHE_TTL = 60;
const GUILD_ADMIN_CACHE_TTL = 300; // requireGuildAdmin と同じ TTL
const guildCacheKey = (userId: string) => `user:${userId}:guilds`;
import {
  getServerDictionaryEntries,
  addServerDictionaryEntry,
  deleteServerDictionaryEntry,
  isGuildPremium,
} from '../services/dictionary-service.js';
import {
  getActiveBotInstances,
  getAvailableBotCount,
  getGuildBoostCount,
  getGuildBotInstanceSettings,
  updateGuildBotInstanceSettings,
  generateBotInviteUrl,
  getGuildsWithBotStatus,
  isBotInGuild,
} from '../services/bot-instance-service.js';
import { REDIS_CHANNELS } from '@sumirevox/shared';
import { publishEvent } from '../infrastructure/pubsub.js';
import { validate } from '../middleware/validate.js';

const discordSnowflakeSchema = z.string().regex(/^\d+$/, '数字文字列の Discord Snowflake を指定してください。');
const paginationQuerySchema = z.object({
  page: z.coerce.number().int('整数で指定してください。').positive('1以上で指定してください。').default(1),
  perPage: z.coerce
    .number()
    .int('整数で指定してください。')
    .min(1, '1以上で指定してください。')
    .max(100, '100以下で指定してください。')
    .default(20),
});
const instanceParamsSchema = z.object({
  guildId: z.string(),
  instanceId: z.coerce.number().int('整数で指定してください。').positive('1以上で指定してください。'),
});
const guildSettingsUpdateSchema = z
  .object({
    maxReadLength: z
      .number()
      .int('整数で指定してください。')
      .min(1, '1以上で指定してください。')
      .max(500, '500以下で指定してください。')
      .optional(),
    readUsername: z.boolean().optional(),
    addSanSuffix: z.boolean().optional(),
    romajiReading: z.boolean().optional(),
    uppercaseReading: z.boolean().optional(),
    joinLeaveNotification: z.boolean().optional(),
    greetingOnJoin: z.boolean().optional(),
    customEmojiHandling: z.enum(['read_name', 'remove']).optional(),
    readTargetType: z.enum(['text_only', 'text_and_sticker', 'text_sticker_and_attachment']).optional(),
    defaultTextChannelId: discordSnowflakeSchema.nullable().optional(),
    defaultSpeakerId: z.number().int('整数で指定してください。').min(0, '0以上で指定してください。').nullable().optional(),
    adminRoleId: discordSnowflakeSchema.nullable().optional(),
    dictionaryPermission: z.enum(['everyone', 'admin_only']).optional(),
  })
  .strict();
const guildBotInstanceSettingsBodySchema = z
  .object({
    autoJoin: z.boolean().optional(),
    textChannelId: z.string().nullable().optional(),
    voiceChannelId: z.string().nullable().optional(),
  })
  .strict();

export const guildsRouter = new Hono();

// 全ルートに認証必須
guildsRouter.use('*', requireAuth);

/**
 * GET /api/guilds
 * 管理権限のあるサーバー一覧
 */
guildsRouter.get('/', async (c) => {
  const session = c.get('session')!;
  const cacheKey = guildCacheKey(session.userId);

  let guilds: Array<{ id: string; name: string; icon: string | null }> | null = null;

  try {
    const cached = await getRedisClient().get(cacheKey);
    if (cached) {
      guilds = JSON.parse(cached) as Array<{ id: string; name: string; icon: string | null }>;
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to read guild cache');
  }

  if (!guilds) {
    try {
      const managed = await fetchManagedGuilds(session.accessToken);
      guilds = managed.map((g) => ({ id: g.id, name: g.name, icon: g.icon }));

      try {
        const redis = getRedisClient();
        await redis.set(cacheKey, JSON.stringify(guilds), 'EX', GUILD_CACHE_TTL);
        // 管理権限ありのギルドを個別にキャッシュし、requireGuildAdmin の Discord API 呼び出しを省略
        await Promise.all(
          managed.map((g) =>
            redis.set(guildAdminCacheKey(session.userId, g.id), 'true', 'EX', GUILD_ADMIN_CACHE_TTL),
          ),
        );
      } catch (err) {
        logger.warn({ err }, 'Failed to write guild cache');
      }
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 429) {
        return c.json(
          { success: false, error: { code: 'RATE_LIMITED', message: err.message } },
          503,
        );
      }
      throw err;
    }
  }

  // Bot 参加状態をチェック（Redis から直接参照、常に最新値を返す）
  const botInstances = await getActiveBotInstances();
  const guildBotStatusMap = await getGuildsWithBotStatus(
    guilds.map((guild) => guild.id),
    botInstances,
  );
  const guildsWithBotStatus = await Promise.all(
    guilds.map(async (guild) => ({ ...guild, botJoined: guildBotStatusMap.get(guild.id) ?? false })),
  );

  return c.json({
    success: true,
    data: {
      guilds: guildsWithBotStatus,
      mainBotClientId: config.discordClientId,
    },
  });
});

/**
 * GET /api/guilds/:guildId/settings
 * サーバー設定取得
 */
guildsRouter.get('/:guildId/settings', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const [settings, isPremium] = await Promise.all([
    getGuildSettings(guildId),
    isGuildPremium(guildId),
  ]);
  return c.json({ success: true, data: { ...settings, isPremium } });
});

/**
 * PUT /api/guilds/:guildId/settings
 * サーバー設定変更
 */
guildsRouter.put('/:guildId/settings', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const body = await validate.body(c, guildSettingsUpdateSchema);

  const [updated, isPremium] = await Promise.all([
    updateGuildSettings(guildId, body),
    isGuildPremium(guildId),
  ]);
  return c.json({ success: true, data: { ...updated, isPremium } });
});

/**
 * GET /api/guilds/:guildId/dictionary
 * サーバー辞書一覧
 */
guildsRouter.get('/:guildId/dictionary', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const { page, perPage } = await validate.query(c, paginationQuerySchema);
  const result = await getServerDictionaryEntries(guildId, page, perPage);
  return c.json({
    success: true,
    data: {
      items: result.items,
      total: result.total,
      page,
      perPage,
    },
  });
});

/**
 * POST /api/guilds/:guildId/dictionary
 * サーバー辞書追加
 */
guildsRouter.post('/:guildId/dictionary', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const session = c.get('session')!;
  const body = await c.req.json<{ word: string; reading: string }>();
  const isPremium = await isGuildPremium(guildId);
  const entry = await addServerDictionaryEntry(
    guildId,
    body.word,
    body.reading,
    session.userId,
    isPremium,
  );
  return c.json({ success: true, data: entry }, 201);
});

/**
 * DELETE /api/guilds/:guildId/dictionary/:word
 * サーバー辞書削除
 */
guildsRouter.delete('/:guildId/dictionary/:word', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const word = decodeURIComponent(c.req.param('word'));
  await deleteServerDictionaryEntry(guildId, word);
  return c.json({ success: true, data: null });
});

// ========================================
// Discord チャンネル・ロール
// ========================================

const CHANNEL_CACHE_TTL = 120;
const ROLE_CACHE_TTL = 120;
const channelCacheKey = (guildId: string) => `guild:${guildId}:channels`;
const roleCacheKey = (guildId: string) => `guild:${guildId}:roles`;

/**
 * GET /api/guilds/:guildId/channels
 * ギルドのチャンネル一覧 (テキスト・ボイス・カテゴリ別)
 */
guildsRouter.get('/:guildId/channels', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const redis = getRedisClient();
  const cacheKey = channelCacheKey(guildId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return c.json({ success: true, data: JSON.parse(cached) as unknown });
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

  return c.json({ success: true, data: result });
});

/**
 * GET /api/guilds/:guildId/roles
 * ギルドのロール一覧 (@everyone・Bot 管理ロール除外)
 */
guildsRouter.get('/:guildId/roles', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const redis = getRedisClient();
  const cacheKey = roleCacheKey(guildId);

  const cached = await redis.get(cacheKey);
  if (cached) {
    return c.json({ success: true, data: JSON.parse(cached) as unknown });
  }

  const roles = await fetchGuildRoles(guildId);

  const result = roles
    .filter((r) => r.name !== '@everyone' && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name, color: r.color }));

  await redis.set(cacheKey, JSON.stringify(result), 'EX', ROLE_CACHE_TTL);

  return c.json({ success: true, data: result });
});

// ========================================
// Bot インスタンス管理
// ========================================

/**
 * GET /api/guilds/:guildId/bots
 * サーバーで利用可能な Bot インスタンス一覧
 */
guildsRouter.get('/:guildId/bots', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');

  const [instances, availableCount, boostCount, instanceSettingsMap] = await Promise.all([
    getActiveBotInstances(),
    getAvailableBotCount(guildId),
    getGuildBoostCount(guildId),
    getGuildBotInstanceSettings(guildId),
  ]);

  const bots = await Promise.all(
    instances.map(async (instance) => {
      const isInGuild = await isBotInGuild(instance.instanceId, guildId);
      const isAvailable = instance.instanceId <= availableCount;
      const settings = isAvailable
        ? (instanceSettingsMap[String(instance.instanceId)] ?? {
            autoJoin: false,
            textChannelId: null,
            voiceChannelId: null,
          })
        : null;
      return {
        instanceNumber: instance.instanceId,
        name: instance.name,
        botUserId: instance.botUserId,
        isActive: instance.isActive,
        isInGuild,
        isAvailable,
        settings,
      };
    }),
  );

  return c.json({
    success: true,
    data: {
      bots,
      boostCount,
      maxBots: availableCount,
    },
  });
});

/**
 * PUT /api/guilds/:guildId/bots/:instanceId/settings
 * 特定インスタンスの設定更新
 */
guildsRouter.put('/:guildId/bots/:instanceId/settings', requireGuildAdmin, async (c) => {
  const { guildId, instanceId } = await validate.params(c, instanceParamsSchema);
  const body = await validate.body(c, guildBotInstanceSettingsBodySchema);

  await updateGuildBotInstanceSettings(guildId, instanceId, body);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));

  return c.json({ success: true, data: null });
});

/**
 * GET /api/guilds/:guildId/bots/:instanceId/invite
 * Bot 招待 URL 取得
 */
guildsRouter.get('/:guildId/bots/:instanceId/invite', requireGuildAdmin, async (c) => {
  const { guildId, instanceId } = await validate.params(c, instanceParamsSchema);

  const availableCount = await getAvailableBotCount(guildId);
  if (instanceId > availableCount) {
    return c.json(
      {
        success: false,
        error: {
          code: 'BOOST_LIMIT_REACHED',
          message: 'このインスタンスを利用するにはブーストが必要です。',
        },
      },
      400,
    );
  }

  const url = await generateBotInviteUrl(instanceId, guildId);
  return c.json({ success: true, data: { url } });
});
