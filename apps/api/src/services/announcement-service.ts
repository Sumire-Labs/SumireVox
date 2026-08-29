import type { Announcement, AnnouncementType } from '@sumirevox/shared';
import { getPrisma } from '../infrastructure/database.js';
import { AppError } from '../infrastructure/app-error.js';

export interface CreateAnnouncementInput {
  title: string;
  body: string;
  type: AnnouncementType;
  published: boolean;
  publishedAt?: Date | null;
}

export interface UpdateAnnouncementInput {
  title?: string;
  body?: string;
  type?: AnnouncementType;
  published?: boolean;
  publishedAt?: Date | null;
}

interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  type: string;
  published: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapAnnouncement(record: AnnouncementRecord): Announcement {
  return {
    id: record.id,
    title: record.title,
    body: record.body,
    type: record.type as AnnouncementType,
    published: record.published,
    publishedAt: record.publishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function publicWhere(now: Date) {
  return {
    published: true,
    publishedAt: { not: null, lte: now },
  } as const;
}

function resolvePublishedAt(published: boolean, publishedAt: Date | null | undefined): Date | null {
  if (!published) return publishedAt ?? null;
  return publishedAt ?? new Date();
}

export async function getPublicAnnouncements(
  page: number,
  perPage: number,
  now = new Date(),
): Promise<{ items: Announcement[]; total: number }> {
  const prisma = getPrisma();
  const where = publicWhere(now);
  const [records, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.announcement.count({ where }),
  ]);

  return { items: records.map(mapAnnouncement), total };
}

export async function getPublicAnnouncement(id: string, now = new Date()): Promise<Announcement> {
  const prisma = getPrisma();
  const record = await prisma.announcement.findFirst({ where: { id, ...publicWhere(now) } });
  if (!record) {
    throw new AppError('NOT_FOUND', 'お知らせが見つかりません。', 404);
  }
  return mapAnnouncement(record);
}

export async function getAdminAnnouncements(
  page: number,
  perPage: number,
): Promise<{ items: Announcement[]; total: number }> {
  const prisma = getPrisma();
  const [records, total] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.announcement.count(),
  ]);

  return { items: records.map(mapAnnouncement), total };
}

export async function getAdminAnnouncement(id: string): Promise<Announcement> {
  const prisma = getPrisma();
  const record = await prisma.announcement.findUnique({ where: { id } });
  if (!record) {
    throw new AppError('NOT_FOUND', 'お知らせが見つかりません。', 404);
  }
  return mapAnnouncement(record);
}

export async function createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
  const prisma = getPrisma();
  const record = await prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      type: input.type,
      published: input.published,
      publishedAt: resolvePublishedAt(input.published, input.publishedAt),
    },
  });
  return mapAnnouncement(record);
}

export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput,
): Promise<Announcement> {
  const prisma = getPrisma();
  const current = await prisma.announcement.findUnique({ where: { id } });
  if (!current) {
    throw new AppError('NOT_FOUND', 'お知らせが見つかりません。', 404);
  }

  const published = input.published ?? current.published;
  const publishedAt = resolvePublishedAt(
    published,
    input.publishedAt !== undefined ? input.publishedAt : current.publishedAt,
  );
  const record = await prisma.announcement.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      published,
      publishedAt,
    },
  });
  return mapAnnouncement(record);
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const prisma = getPrisma();
  const current = await prisma.announcement.findUnique({ where: { id } });
  if (!current) {
    throw new AppError('NOT_FOUND', 'お知らせが見つかりません。', 404);
  }
  await prisma.announcement.delete({ where: { id } });
}
