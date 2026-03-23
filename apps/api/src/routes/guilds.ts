import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { requireGuildAdmin } from '../middleware/require-guild-admin.js';
import { fetchManagedGuilds } from '../services/discord-api.js';
import { getGuildSettings, updateGuildSettings } from '../services/guild-settings-service.js';
import {
  getServerDictionaryEntries,
  addServerDictionaryEntry,
  deleteServerDictionaryEntry,
  isGuildPremium,
} from '../services/dictionary-service.js';

export const guildsRouter = new Hono();

// 全ルートに認証必須
guildsRouter.use('*', requireAuth);

/**
 * GET /api/guilds
 * 管理権限のあるサーバー一覧
 */
guildsRouter.get('/', async (c) => {
  const session = c.get('session')!;
  const guilds = await fetchManagedGuilds(session.accessToken);
  return c.json({
    success: true,
    data: guilds.map((g) => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
    })),
  });
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
