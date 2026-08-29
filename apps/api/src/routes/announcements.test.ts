import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

const { getPublicAnnouncementMock, getPublicAnnouncementsMock } = vi.hoisted(() => ({
  getPublicAnnouncementMock: vi.fn(),
  getPublicAnnouncementsMock: vi.fn(),
}));

vi.mock('../services/announcement-service.js', () => ({
  getPublicAnnouncement: getPublicAnnouncementMock,
  getPublicAnnouncements: getPublicAnnouncementsMock,
}));

import { announcementsRouter } from './announcements.js';
import { errorHandler } from '../middleware/error-handler.js';

const app = new Hono();
app.onError(errorHandler);
app.route('/', announcementsRouter);

describe('public announcements routes', () => {
  it('returns the existing success envelope and pagination fields', async () => {
    getPublicAnnouncementsMock.mockResolvedValue({ items: [], total: 0 });

    const response = await app.request('http://localhost/?page=1&perPage=2');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { items: [], total: 0, page: 1, perPage: 2 },
    });
    expect(getPublicAnnouncementsMock).toHaveBeenCalledWith(1, 2);
  });

  it('validates the id before fetching a public detail', async () => {
    const response = await app.request('http://localhost/not-a-cuid');

    expect(response.status).toBe(400);
    expect(getPublicAnnouncementMock).not.toHaveBeenCalled();
  });
});
