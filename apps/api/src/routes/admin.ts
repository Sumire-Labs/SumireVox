import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { requireBotAdmin } from '../middleware/require-bot-admin.js';
import { getPrisma } from '../infrastructure/database.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';
import { getGuildInfo } from '../infrastructure/discord-guild-info.js';
import { getGuildSettings, updateGuildSettings } from '../services/guild-settings-service.js';
import { isGuildPremium } from '../services/dictionary-service.js';
import { fetchGuildChannels, fetchGuildRoles } from '../services/discord-api.js';
import {
  getAllBotInstances,
  setBotInstanceActive,
  getActiveBotInstances,
  getAvailableBotCount,
  getGuildBoostCount,
  getGuildBotInstanceSettings,
  updateGuildBotInstanceSettings,
  isBotInGuild,
} from '../services/bot-instance-service.js';
import { REDIS_KEYS, REDIS_CHANNELS } from '@sumirevox/shared';
import { publishEvent } from '../infrastructure/pubsub.js';
import {
  getGlobalDictionaryEntries,
  addGlobalDictionaryEntry,
  updateGlobalDictionaryEntry,
  deleteGlobalDictionaryEntry,
  getGlobalDictionaryRequests,
  approveRequest,
  rejectRequest,
} from '../services/admin-dictionary-service.js';
import { validate } from '../middleware/validate.js';

const paginationQuerySchema = z.object({
  page: z.coerce.number().int('整数で指定してください。').positive('1以上で指定してください。').default(1),
  perPage: z.coerce
    .number()
    .int('整数で指定してください。')
    .min(1, '1以上で指定してください。')
    .max(100, '100以下で指定してください。')
    .default(20),
});
const dictionaryRequestsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
});
const discordSnowflakeSchema = z.string().regex(/^\d+$/, '数字文字列の Discord Snowflake を指定してください。');
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
const adminGuildSettingsUpdateSchema = guildSettingsUpdateSchema.extend({
  manualPremium: z.boolean().optional(),
});
const instanceParamsSchema = z.object({
  guildId: z.string(),
  instanceId: z.coerce.number().int('整数で指定してください。').positive('1以上で指定してください。'),
});
const guildBotInstanceSettingsBodySchema = z
  .object({
    autoJoin: z.boolean().optional(),
    textChannelId: z.string().nullable().optional(),
    voiceChannelId: z.string().nullable().optional(),
  })
  .strict();

export const adminRouter = new Hono();

// 全ルートに認証 + Bot 管理者チェック
adminRouter.use('*', requireAuth, requireBotAdmin);

/**
 * GET /api/admin/servers
 * 全サーバー一覧（Bot が現在参加している全サーバー。guild_settings 未登録サーバーはデフォルト値で表示）
 */
adminRouter.get('/servers', async (c) => {
  const prisma = getPrisma();
  const { page, perPage } = await validate.query(c, paginationQuerySchema);

  // Redis の BOT_GUILDS セットから Bot が現在参加しているギルド ID を収集
  const botInstances = await getAllBotInstances();
  const redis = getRedisClient();
  const guildIdSets = await Promise.all(
    botInstances.map((instance) =>
      redis.smembers(REDIS_KEYS.BOT_GUILDS(instance.instanceId)).catch(() => [] as string[]),
    ),
  );
  const botGuildIds = [...new Set(guildIdSets.flat())].sort();

  const total = botGuildIds.length;
  if (total === 0) {
    return c.json({ success: true, data: { items: [], total: 0, page, perPage } });
  }

  // ページネーション（Redis セット上で行う）
  const pagedGuildIds = botGuildIds.slice((page - 1) * perPage, page * perPage);

  // guild_settings から既存レコードを取得（存在するもののみ）
  const existingSettings = await prisma.guildSettings.findMany({
    where: { guildId: { in: pagedGuildIds } },
  });
  const settingsMap = new Map(existingSettings.map((s) => [s.guildId, s]));

  // Discord からギルド情報を取得
  const guildInfos = await Promise.all(pagedGuildIds.map((id) => getGuildInfo(id)));

  return c.json({
    success: true,
    data: {
      items: pagedGuildIds.map((guildId, i) => {
        const settings = settingsMap.get(guildId);
        const info = guildInfos[i];
        return {
          guildId,
          name: info?.name ?? guildId,
          icon: info?.icon ?? null,
          manualPremium: settings?.manualPremium ?? false,
          botJoinedAt: info?.botJoinedAt ?? null,
        };
      }),
      total,
      page,
      perPage,
    },
  });
});

/**
 * PUT /api/admin/servers/:guildId/premium
 * 手動 PREMIUM の ON/OFF 切り替え
 * body: { manualPremium: boolean }
 */
adminRouter.put('/servers/:guildId/premium', async (c) => {
  const guildId = c.req.param('guildId');
  const body = await c.req.json<{ manualPremium: boolean }>();
  if (typeof body.manualPremium !== 'boolean') {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'manualPremium は boolean で指定してください。' },
      },
      400,
    );
  }
  const updated = await updateGuildSettings(guildId, { manualPremium: body.manualPremium });
  return c.json({ success: true, data: { guildId: updated.guildId, manualPremium: updated.manualPremium } });
});

/**
 * GET /api/admin/servers/:guildId/settings
 * サーバー設定取得（管理者用）
 */
const ADMIN_ROLE_CACHE_TTL = 120;
const adminRoleCacheKey = (guildId: string) => `guild:${guildId}:roles`;

adminRouter.get('/servers/:guildId/settings', async (c) => {
  const guildId = c.req.param('guildId');

  const [settings, isPremium, guildInfo] = await Promise.all([
    getGuildSettings(guildId),
    isGuildPremium(guildId),
    getGuildInfo(guildId),
  ]);

  const redis = getRedisClient();
  const cacheKey = adminRoleCacheKey(guildId);
  let roles: Array<{ id: string; name: string; color: number }> = [];

  const cachedRoles = await redis.get(cacheKey);
  if (cachedRoles) {
    roles = JSON.parse(cachedRoles) as Array<{ id: string; name: string; color: number }>;
  } else {
    try {
      const rawRoles = await fetchGuildRoles(guildId);
      roles = rawRoles
        .filter((r) => r.name !== '@everyone' && !r.managed)
        .sort((a, b) => b.position - a.position)
        .map((r) => ({ id: r.id, name: r.name, color: r.color }));
      await redis.set(cacheKey, JSON.stringify(roles), 'EX', ADMIN_ROLE_CACHE_TTL);
    } catch (err) {
      logger.warn({ err, guildId }, 'Failed to fetch guild roles for admin settings');
    }
  }

  return c.json({
    success: true,
    data: {
      ...settings,
      isPremium,
      name: guildInfo?.name ?? guildId,
      icon: guildInfo?.icon ?? null,
      roles,
    },
  });
});

/**
 * PUT /api/admin/servers/:guildId/settings
 * サーバー設定変更（管理者用）
 */
adminRouter.put('/servers/:guildId/settings', async (c) => {
  const guildId = c.req.param('guildId');
  const body = await validate.body(c, adminGuildSettingsUpdateSchema);

  const [updated, isPremium] = await Promise.all([
    updateGuildSettings(guildId, body),
    isGuildPremium(guildId),
  ]);
  return c.json({ success: true, data: { ...updated, isPremium } });
});

// ========================================
// グローバル辞書管理
// ========================================

/**
 * GET /api/admin/dictionary/global
 */
adminRouter.get('/dictionary/global', async (c) => {
  const { page, perPage } = await validate.query(c, paginationQuerySchema);
  const result = await getGlobalDictionaryEntries(page, perPage);
  return c.json({
    success: true,
    data: { items: result.items, total: result.total, page, perPage },
  });
});

/**
 * POST /api/admin/dictionary/global
 * body: { word: string, reading: string }
 */
adminRouter.post('/dictionary/global', async (c) => {
  const session = c.get('session')!;
  const body = await c.req.json<{ word: string; reading: string }>();
  const entry = await addGlobalDictionaryEntry(body.word, body.reading, session.userId);
  return c.json({ success: true, data: entry }, 201);
});

/**
 * PUT /api/admin/dictionary/global/:word
 * body: { reading: string }
 */
adminRouter.put('/dictionary/global/:word', async (c) => {
  const word = decodeURIComponent(c.req.param('word'));
  const body = await c.req.json<{ reading: string }>();
  const entry = await updateGlobalDictionaryEntry(word, body.reading);
  return c.json({ success: true, data: entry });
});

/**
 * DELETE /api/admin/dictionary/global/:word
 */
adminRouter.delete('/dictionary/global/:word', async (c) => {
  const word = decodeURIComponent(c.req.param('word'));
  await deleteGlobalDictionaryEntry(word);
  return c.json({ success: true, data: null });
});

// ========================================
// 申請管理
// ========================================

/**
 * GET /api/admin/dictionary/requests
 */
adminRouter.get('/dictionary/requests', async (c) => {
  const { page, perPage, status } = await validate.query(c, dictionaryRequestsQuerySchema);
  const result = await getGlobalDictionaryRequests(page, perPage, status);
  return c.json({
    success: true,
    data: { items: result.items, total: result.total, page, perPage },
  });
});

/**
 * PUT /api/admin/dictionary/requests/:id/approve
 */
adminRouter.put('/dictionary/requests/:id/approve', async (c) => {
  const id = c.req.param('id');
  await approveRequest(id);
  return c.json({ success: true, data: null });
});

/**
 * PUT /api/admin/dictionary/requests/:id/reject
 */
adminRouter.put('/dictionary/requests/:id/reject', async (c) => {
  const id = c.req.param('id');
  await rejectRequest(id);
  return c.json({ success: true, data: null });
});

// ========================================
// サーバー Bot 設定（管理者用）
// ========================================

const ADMIN_CHANNEL_CACHE_TTL = 120;
const adminChannelCacheKey = (guildId: string) => `guild:${guildId}:channels`;

/**
 * GET /api/admin/servers/:guildId/bots
 * サーバーで利用可能な Bot インスタンス一覧（管理者用）
 */
adminRouter.get('/servers/:guildId/bots', async (c) => {
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
 * PUT /api/admin/servers/:guildId/bots/:instanceId/settings
 * 特定インスタンスの設定更新（管理者用）
 */
adminRouter.put('/servers/:guildId/bots/:instanceId/settings', async (c) => {
  const { guildId, instanceId } = await validate.params(c, instanceParamsSchema);
  const body = await validate.body(c, guildBotInstanceSettingsBodySchema);

  await updateGuildBotInstanceSettings(guildId, instanceId, body);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));

  return c.json({ success: true, data: null });
});

/**
 * GET /api/admin/servers/:guildId/channels
 * ギルドのチャンネル一覧（管理者用）
 */
adminRouter.get('/servers/:guildId/channels', async (c) => {
  const guildId = c.req.param('guildId');
  const redis = getRedisClient();
  const cacheKey = adminChannelCacheKey(guildId);

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
  await redis.set(cacheKey, JSON.stringify(result), 'EX', ADMIN_CHANNEL_CACHE_TTL);

  return c.json({ success: true, data: result });
});

// ========================================
// Bot インスタンス管理
// ========================================

/**
 * GET /api/admin/bot-instances
 * 全 Bot インスタンス一覧
 */
adminRouter.get('/bot-instances', async (c) => {
  const instances = await getAllBotInstances();
  return c.json({ success: true, data: instances });
});

/**
 * PUT /api/admin/bot-instances/:instanceId/active
 * Bot インスタンスのアクティブ状態変更
 * body: { isActive: boolean }
 */
adminRouter.put('/bot-instances/:instanceId/active', async (c) => {
  const instanceId = parseInt(c.req.param('instanceId'), 10);
  const body = await c.req.json<{ isActive: boolean }>();

  if (typeof body.isActive !== 'boolean') {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'isActive は boolean で指定してください。' },
      },
      400,
    );
  }

  const instance = await setBotInstanceActive(instanceId, body.isActive);
  return c.json({ success: true, data: instance });
});
