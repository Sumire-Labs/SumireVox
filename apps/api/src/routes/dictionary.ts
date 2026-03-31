import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/require-auth.js';
import { validate } from '../middleware/validate.js';
import { getGlobalDictionaryEntries } from '../services/dictionary-service.js';

export const dictionaryRouter = new Hono();

const paginationQuerySchema = z.object({
  page: z.coerce.number().int('整数で指定してください。').positive('1以上で指定してください。').default(1),
  perPage: z.coerce
    .number()
    .int('整数で指定してください。')
    .min(1, '1以上で指定してください。')
    .max(100, '100以下で指定してください。')
    .default(20),
});

dictionaryRouter.use('*', requireAuth);

/**
 * GET /api/dictionary/global
 * グローバル辞書一覧（閲覧のみ）
 */
dictionaryRouter.get('/global', async (c) => {
  const { page, perPage } = await validate.query(c, paginationQuerySchema);
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
