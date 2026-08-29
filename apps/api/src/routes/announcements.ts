import { Hono } from 'hono';
import { validate } from '../middleware/validate.js';
import { paginationQuerySchema, announcementIdParamsSchema } from '../schemas/common.js';
import { getPublicAnnouncement, getPublicAnnouncements } from '../services/announcement-service.js';

export const announcementsRouter = new Hono();

announcementsRouter.get('/', async (c) => {
  const { page, perPage } = await validate.query(c, paginationQuerySchema);
  const result = await getPublicAnnouncements(page, perPage);
  return c.json({ success: true, data: { items: result.items, total: result.total, page, perPage } });
});

announcementsRouter.get('/:id', async (c) => {
  const { id } = await validate.params(c, announcementIdParamsSchema);
  const announcement = await getPublicAnnouncement(id);
  return c.json({ success: true, data: announcement });
});
