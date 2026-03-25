import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { requireGuildAdmin } from '../middleware/require-guild-admin.js';
import { fetchManagedGuilds } from '../services/discord-api.js';
import { getGuildSettings, updateGuildSettings } from '../services/guild-settings-service.js';
import { AppError } from '../infrastructure/app-error.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

const GUILD_CACHE_TTL = 60;
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
  getGuildBotInstanceSettings,
  updateGuildBotInstanceSettings,
  generateBotInviteUrl,
  isBotInGuild,
} from '../services/bot-instance-service.js';
import { REDIS_CHANNELS } from '@sumirevox/shared';
import { publishEvent } from '../infrastructure/pubsub.js';

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

  try {
    const cached = await getRedisClient().get(cacheKey);
    if (cached) {
      return c.json({ success: true, data: JSON.parse(cached) });
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to read guild cache');
  }

  try {
    const guilds = await fetchManagedGuilds(session.accessToken);
    const data = guilds.map((g) => ({ id: g.id, name: g.name, icon: g.icon }));

    try {
      await getRedisClient().set(cacheKey, JSON.stringify(data), 'EX', GUILD_CACHE_TTL);
    } catch (err) {
      logger.warn({ err }, 'Failed to write guild cache');
    }

    return c.json({ success: true, data });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 429) {
      return c.json(
        { success: false, error: { code: 'RATE_LIMITED', message: err.message } },
        503,
      );
    }
    throw err;
  }
});

/**
 * GET /api/guilds/:guildId/settings
 * サーバー設定取得
 */
guildsRouter.get('/:guildId/settings', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const settings = await getGuildSettings(guildId);
  return c.json({ success: true, data: settings });
});

/**
 * PUT /api/guilds/:guildId/settings
 * サーバー設定変更
 */
guildsRouter.put('/:guildId/settings', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const body = await c.req.json<Record<string, unknown>>();

  // guildId と manualPremium はリクエストから更新不可
  delete body['guildId'];
  delete body['manualPremium'];

  const updated = await updateGuildSettings(guildId, body);
  return c.json({ success: true, data: updated });
});

/**
 * GET /api/guilds/:guildId/dictionary
 * サーバー辞書一覧
 */
guildsRouter.get('/:guildId/dictionary', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10);
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
// Bot インスタンス管理
// ========================================

/**
 * GET /api/guilds/:guildId/bots
 * サーバーで利用可能な Bot インスタンス一覧
 */
guildsRouter.get('/:guildId/bots', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');

  const [instances, availableCount, instanceSettingsMap] = await Promise.all([
    getActiveBotInstances(),
    getAvailableBotCount(guildId),
    getGuildBotInstanceSettings(guildId),
  ]);

  const instancesWithStatus = await Promise.all(
    instances.map(async (instance) => {
      const isInGuild = await isBotInGuild(instance.instanceId, guildId);
      const settings = instanceSettingsMap[String(instance.instanceId)] ?? {
        autoJoin: false,
        textChannelId: null,
        voiceChannelId: null,
      };
      return {
        instanceId: instance.instanceId,
        name: instance.name,
        botUserId: instance.botUserId,
        isActive: instance.isActive,
        isInGuild,
        settings,
      };
    }),
  );

  return c.json({
    success: true,
    data: {
      availableCount,
      instances: instancesWithStatus,
    },
  });
});

/**
 * PUT /api/guilds/:guildId/bots/:instanceId/settings
 * 特定インスタンスの設定更新
 */
guildsRouter.put('/:guildId/bots/:instanceId/settings', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const instanceId = parseInt(c.req.param('instanceId'), 10);
  const body = await c.req.json<{ autoJoin?: boolean; textChannelId?: string | null; voiceChannelId?: string | null }>();

  await updateGuildBotInstanceSettings(guildId, instanceId, body);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));

  return c.json({ success: true, data: null });
});

/**
 * GET /api/guilds/:guildId/bots/:instanceId/invite
 * Bot 招待 URL 取得
 */
guildsRouter.get('/:guildId/bots/:instanceId/invite', requireGuildAdmin, async (c) => {
  const guildId = c.req.param('guildId');
  const instanceId = parseInt(c.req.param('instanceId'), 10);

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
