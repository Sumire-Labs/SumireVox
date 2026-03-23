import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { getGlobalDictionaryEntries } from '../services/dictionary-service.js';

export const dictionaryRouter = new Hono();

dictionaryRouter.use('*', requireAuth);

/**
 * GET /api/dictionary/global
 * グローバル辞書一覧（閲覧のみ）
 */
dictionaryRouter.get('/global', async (c) => {
  const page = parseInt(c.req.query('page') ?? '1', 10);
  const perPage = parseInt(c.req.query('perPage') ?? '20', 10);
  const result = await getGlobalDictionaryEntries(page, perPage);
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
