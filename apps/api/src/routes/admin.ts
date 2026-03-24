import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { requireBotAdmin } from '../middleware/require-bot-admin.js';
import { getPrisma } from '../infrastructure/database.js';
import { updateGuildSettings } from '../services/guild-settings-service.js';
import { getAllBotInstances, setBotInstanceActive } from '../services/bot-instance-service.js';
import {
  getGlobalDictionaryEntries,
  addGlobalDictionaryEntry,
  updateGlobalDictionaryEntry,
  deleteGlobalDictionaryEntry,
  getGlobalDictionaryRequests,
  approveRequest,
  rejectRequest,
} from '../services/admin-dictionary-service.js';

export const adminRouter = new Hono();

// 全ルートに認証 + Bot 管理者チェック
adminRouter.use('*', requireAuth, requireBotAdmin);

/**
 * GET /api/admin/servers
 * 全サーバー一覧（Bot が参加しているサーバーの GuildSettings）
 */
adminRouter.get('/servers', async (c) => {
  const prisma = getPrisma();
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10);
  const [servers, total] = await Promise.all([
    prisma.guildSettings.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.guildSettings.count(),
  ]);
  return c.json({
    success: true,
    data: {
      items: servers.map((s) => ({
        guildId: s.guildId,
        manualPremium: s.manualPremium,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
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

// ========================================
// グローバル辞書管理
// ========================================

/**
 * GET /api/admin/dictionary/global
 */
adminRouter.get('/dictionary/global', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10);
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
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10);
  const status = c.req.query('status');
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
