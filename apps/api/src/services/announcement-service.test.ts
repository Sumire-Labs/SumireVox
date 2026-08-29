import { beforeEach, describe, expect, it, vi } from 'vitest';
const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    announcement: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock('../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

import {
  createAnnouncement,
  deleteAnnouncement,
  getAdminAnnouncements,
  getPublicAnnouncement,
  getPublicAnnouncements,
  updateAnnouncement,
} from './announcement-service.js';

const createdAt = new Date('2026-08-29T00:00:00.000Z');
const publishedAt = new Date('2026-08-28T00:00:00.000Z');
const baseRecord = {
  id: 'cmf5q4m9p0000l7w0e6x2b3cd',
  title: 'メンテナンスのお知らせ',
  body: '本文です。',
  type: 'maintenance',
  published: true,
  publishedAt,
  createdAt,
  updatedAt: createdAt,
};

describe('announcement-service', () => {
  beforeEach(() => {
    prismaMock.announcement.findMany.mockReset();
    prismaMock.announcement.findFirst.mockReset();
    prismaMock.announcement.findUnique.mockReset();
    prismaMock.announcement.count.mockReset();
    prismaMock.announcement.create.mockReset();
    prismaMock.announcement.update.mockReset();
    prismaMock.announcement.delete.mockReset();
  });

  it('only queries currently visible announcements in newest publish order', async () => {
    const now = new Date('2026-08-29T12:00:00.000Z');
    prismaMock.announcement.findMany.mockResolvedValue([baseRecord]);
    prismaMock.announcement.count.mockResolvedValue(1);

    const result = await getPublicAnnouncements(2, 20, now);

    expect(prismaMock.announcement.findMany).toHaveBeenCalledWith({
      where: { published: true, publishedAt: { not: null, lte: now } },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: 20,
      take: 20,
    });
    expect(prismaMock.announcement.count).toHaveBeenCalledWith({
      where: { published: true, publishedAt: { not: null, lte: now } },
    });
    expect(result.items[0]).toMatchObject({ id: baseRecord.id, type: 'maintenance' });
  });

  it('does not expose an unpublished or scheduled announcement by id', async () => {
    prismaMock.announcement.findFirst.mockResolvedValue(null);

    await expect(
      getPublicAnnouncement(baseRecord.id, new Date('2026-08-29T12:00:00.000Z')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
    expect(prismaMock.announcement.findFirst).toHaveBeenCalledWith({
      where: {
        id: baseRecord.id,
        published: true,
        publishedAt: { not: null, lte: new Date('2026-08-29T12:00:00.000Z') },
      },
    });
  });

  it('creates published announcements with an immediate publish time when omitted', async () => {
    prismaMock.announcement.create.mockResolvedValue(baseRecord);

    const result = await createAnnouncement({
      title: baseRecord.title,
      body: baseRecord.body,
      type: 'maintenance',
      published: true,
    });

    expect(prismaMock.announcement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: baseRecord.title,
        body: baseRecord.body,
        type: 'maintenance',
        published: true,
      }),
    });
    const createCall = prismaMock.announcement.create.mock.calls[0]?.[0] as { data: { publishedAt: Date } };
    expect(createCall.data.publishedAt).toBeInstanceOf(Date);
    expect(result.id).toBe(baseRecord.id);
  });

  it('updates and deletes only an existing admin announcement', async () => {
    prismaMock.announcement.findUnique.mockResolvedValue(baseRecord);
    prismaMock.announcement.update.mockResolvedValue({ ...baseRecord, published: false, publishedAt: null });
    prismaMock.announcement.delete.mockResolvedValue(baseRecord);

    await updateAnnouncement(baseRecord.id, { published: false });
    await deleteAnnouncement(baseRecord.id);

    expect(prismaMock.announcement.update).toHaveBeenCalledWith({
      where: { id: baseRecord.id },
      data: { published: false, publishedAt },
    });
    expect(prismaMock.announcement.delete).toHaveBeenCalledWith({ where: { id: baseRecord.id } });
  });

  it('uses the existing offset pagination for the admin list', async () => {
    prismaMock.announcement.findMany.mockResolvedValue([baseRecord]);
    prismaMock.announcement.count.mockResolvedValue(21);

    const result = await getAdminAnnouncements(2, 20);

    expect(prismaMock.announcement.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      skip: 20,
      take: 20,
    });
    expect(result.total).toBe(21);
  });
});
