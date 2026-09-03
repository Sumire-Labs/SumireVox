import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { requireBotAdmin } from '../middleware/require-bot-admin.js';
import { getPrisma } from '../infrastructure/database.js';
import { logger } from '../infrastructure/logger.js';
import { getGuildInfo } from '../infrastructure/discord-guild-info.js';
import { getGuildSettings, updateGuildSettings } from '../services/guild-settings-service.js';
import { isGuildPremium } from '../services/dictionary-service.js';
import {
  getAllBotInstances,
  getBotGuildMemberships,
  setBotInstanceActive,
  getGuildBotList,
  updateGuildAutoJoinSettings,
  updateGuildBotInstancePriority,
} from '../services/bot-instance-service.js';
import { REDIS_CHANNELS, type AdminServerItem } from '@sumirevox/shared';
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
import { getGuildChannelsSorted } from '../services/guild-channel-service.js';
import { getGuildRolesSorted } from '../services/guild-role-service.js';
import { rateLimit } from '../middleware/rate-limit.js';
import {
  discordSnowflakeSchema,
  paginationQuerySchema,
  guildSettingsUpdateSchema,
  instanceParamsSchema,
  autoJoinSettingsBodySchema,
  botInstancePriorityBodySchema,
  announcementIdParamsSchema,
  announcementCreateBodySchema,
  announcementUpdateBodySchema,
} from '../schemas/common.js';
import {
  createAnnouncement,
  deleteAnnouncement,
  getAdminAnnouncement,
  getAdminAnnouncements,
  updateAnnouncement,
} from '../services/announcement-service.js';

const adminDictRateLimit = rateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'admin-dict' });
const adminBotSettingsRateLimit = rateLimit({ max: 30, windowSeconds: 60, keyPrefix: 'admin-bot-settings' });

const dictionaryRequestsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
});
const adminGuildSettingsUpdateSchema = guildSettingsUpdateSchema.extend({
  manualPremium: z.boolean().optional(),
});
const guildParamsSchema = z.object({ guildId: discordSnowflakeSchema });
const requestIdParamsSchema = z.object({ id: z.string().cuid() });
const globalDictWordParamsSchema = z.object({
  word: z.string().min(1).transform(decodeURIComponent),
});
const botInstanceParamsSchema = z.object({
  instanceId: z.coerce.number().int('整数で指定してください。').positive('1以上で指定してください。'),
});
const manualPremiumBodySchema = z.object({ manualPremium: z.boolean() }).strict();
const globalDictionaryBodySchema = z
  .object({ word: z.string().min(1), reading: z.string().min(1) })
  .strict();
const globalDictionaryUpdateBodySchema = z.object({ reading: z.string().min(1) }).strict();
const botInstanceActiveBodySchema = z.object({ isActive: z.boolean() }).strict();

export const adminRouter = new Hono();

// 全ルートに認証 + Bot 管理者チェック
adminRouter.use('*', requireAuth, requireBotAdmin);

// ========================================
// お知らせ管理
// ========================================

adminRouter.get('/announcements', async (c) => {
  const { page, perPage } = await validate.query(c, paginationQuerySchema);
  const result = await getAdminAnnouncements(page, perPage);
  return c.json({
    success: true,
    data: { items: result.items, total: result.total, page, perPage },
  });
});

adminRouter.get('/announcements/:id', async (c) => {
  const { id } = await validate.params(c, announcementIdParamsSchema);
  const announcement = await getAdminAnnouncement(id);
  return c.json({ success: true, data: announcement });
});

adminRouter.post('/announcements', async (c) => {
  const body = await validate.body(c, announcementCreateBodySchema);
  const announcement = await createAnnouncement(body);
  return c.json({ success: true, data: announcement }, 201);
});

adminRouter.put('/announcements/:id', async (c) => {
  const { id } = await validate.params(c, announcementIdParamsSchema);
  const body = await validate.body(c, announcementUpdateBodySchema);
  const announcement = await updateAnnouncement(id, body);
  return c.json({ success: true, data: announcement });
});

adminRouter.delete('/announcements/:id', async (c) => {
  const { id } = await validate.params(c, announcementIdParamsSchema);
  await deleteAnnouncement(id);
  return c.json({ success: true, data: null });
});

/**
 * GET /api/admin/servers
 * 全サーバー一覧（Bot が現在参加している全サーバー。guild_settings 未登録サーバーはデフォルト値で表示）
 */
adminRouter.get('/servers', async (c) => {
  const prisma = getPrisma();
  const { page, perPage } = await validate.query(c, paginationQuerySchema);

  // Redis の BOT_GUILDS セットから Bot が現在参加しているギルド ID とインスタンスを収集
  const botInstances = await getAllBotInstances();
  const botGuildMemberships = await getBotGuildMemberships(botInstances);
  const botGuildIds = [...botGuildMemberships.keys()].sort();

  const total = botGuildIds.length;
  if (total === 0) {
    return c.json({ success: true, data: { items: [], total: 0, page, perPage } });
  }

  // ページネーション（Redis セット上で行う）
  const pagedGuildIds = botGuildIds.slice((page - 1) * perPage, page * perPage);

  const [existingSettings, boostGroups, guildInfos] = await Promise.all([
    prisma.guildSettings.findMany({
      where: { guildId: { in: pagedGuildIds } },
    }),
    prisma.boost.groupBy({
      by: ['guildId'],
      where: {
        guildId: { in: pagedGuildIds },
        subscription: { status: 'ACTIVE' },
      },
      _count: { id: true },
    }),
    Promise.all(pagedGuildIds.map((id) => getGuildInfo(id))),
  ]);
  const settingsMap = new Map(existingSettings.map((s) => [s.guildId, s]));
  const boostCountMap = new Map<string, number>();
  boostGroups.forEach((group) => {
    if (group.guildId) boostCountMap.set(group.guildId, group._count.id);
  });
  const botInstanceMap = new Map(botInstances.map((instance) => [instance.instanceId, instance]));

  return c.json({
    success: true,
    data: {
      items: pagedGuildIds.map((guildId, i): AdminServerItem => {
        const settings = settingsMap.get(guildId);
        const info = guildInfos[i];
        const installedBotInstances = (botGuildMemberships.get(guildId) ?? []).flatMap((instanceId) => {
          const instance = botInstanceMap.get(instanceId);
          return instance
            ? [{ instanceId: instance.instanceId, name: instance.name, isActive: instance.isActive }]
            : [];
        });
        return {
          guildId,
          name: info?.name ?? guildId,
          icon: info?.icon ?? null,
          manualPremium: settings?.manualPremium ?? false,
          botJoinedAt: info?.botJoinedAt ?? null,
          boostCount: boostCountMap.get(guildId) ?? 0,
          botInstances: installedBotInstances,
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
  const { guildId } = await validate.params(c, guildParamsSchema);
  const body = await validate.body(c, manualPremiumBodySchema);
  const updated = await updateGuildSettings(guildId, { manualPremium: body.manualPremium });
  return c.json({ success: true, data: { guildId: updated.guildId, manualPremium: updated.manualPremium } });
});

/**
 * GET /api/admin/servers/:guildId/settings
 * サーバー設定取得（管理者用）
 */
adminRouter.get('/servers/:guildId/settings', async (c) => {
  const { guildId } = await validate.params(c, guildParamsSchema);

  const [settings, isPremium, guildInfo] = await Promise.all([
    getGuildSettings(guildId),
    isGuildPremium(guildId),
    getGuildInfo(guildId),
  ]);

  let roles: Array<{ id: string; name: string; color: number }> = [];
  try {
    roles = await getGuildRolesSorted(guildId);
  } catch (err) {
    logger.warn({ err, guildId }, 'Failed to fetch guild roles for admin settings');
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
  const { guildId } = await validate.params(c, guildParamsSchema);
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
adminRouter.post('/dictionary/global', adminDictRateLimit, async (c) => {
  const session = c.get('session')!;
  const body = await validate.body(c, globalDictionaryBodySchema);
  const entry = await addGlobalDictionaryEntry(body.word, body.reading, session.userId);
  return c.json({ success: true, data: entry }, 201);
});

/**
 * PUT /api/admin/dictionary/global/:word
 * body: { reading: string }
 */
adminRouter.put('/dictionary/global/:word', async (c) => {
  const { word } = await validate.params(c, globalDictWordParamsSchema);
  const body = await validate.body(c, globalDictionaryUpdateBodySchema);
  const entry = await updateGlobalDictionaryEntry(word, body.reading);
  return c.json({ success: true, data: entry });
});

/**
 * DELETE /api/admin/dictionary/global/:word
 */
adminRouter.delete('/dictionary/global/:word', async (c) => {
  const { word } = await validate.params(c, globalDictWordParamsSchema);
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
  const { id } = await validate.params(c, requestIdParamsSchema);
  await approveRequest(id);
  return c.json({ success: true, data: null });
});

/**
 * PUT /api/admin/dictionary/requests/:id/reject
 */
adminRouter.put('/dictionary/requests/:id/reject', async (c) => {
  const { id } = await validate.params(c, requestIdParamsSchema);
  await rejectRequest(id);
  return c.json({ success: true, data: null });
});

// ========================================
// サーバー Bot 設定（管理者用）
// ========================================

/**
 * GET /api/admin/servers/:guildId/bots
 * サーバーで利用可能な Bot インスタンス一覧（管理者用）
 */
adminRouter.get('/servers/:guildId/bots', async (c) => {
  const { guildId } = await validate.params(c, guildParamsSchema);
  const result = await getGuildBotList(guildId);

  return c.json({
    success: true,
    data: result,
  });
});

adminRouter.put('/servers/:guildId/auto-join-settings', adminBotSettingsRateLimit, async (c) => {
  const { guildId } = await validate.params(c, guildParamsSchema);
  const body = await validate.body(c, autoJoinSettingsBodySchema);
  await updateGuildAutoJoinSettings(guildId, body);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));
  return c.json({ success: true, data: null });
});

adminRouter.put('/servers/:guildId/bot-priority', adminBotSettingsRateLimit, async (c) => {
  const { guildId } = await validate.params(c, guildParamsSchema);
  const { instanceIds } = await validate.body(c, botInstancePriorityBodySchema);
  await updateGuildBotInstancePriority(guildId, instanceIds);
  await publishEvent(REDIS_CHANNELS.GUILD_SETTINGS_UPDATED, JSON.stringify({ guildId }));
  return c.json({ success: true, data: null });
});

/**
 * GET /api/admin/servers/:guildId/channels
 * ギルドのチャンネル一覧（管理者用）
 */
adminRouter.get('/servers/:guildId/channels', async (c) => {
  const { guildId } = await validate.params(c, guildParamsSchema);
  const result = await getGuildChannelsSorted(guildId);
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
  const { instanceId } = await validate.params(c, botInstanceParamsSchema);
  const body = await validate.body(c, botInstanceActiveBodySchema);
  const instance = await setBotInstanceActive(instanceId, body.isActive);
  return c.json({ success: true, data: instance });
});
