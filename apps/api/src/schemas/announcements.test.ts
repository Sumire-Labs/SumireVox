import { describe, expect, it } from 'vitest';
import { announcementCreateBodySchema, announcementUpdateBodySchema } from './common.js';

describe('announcement schemas', () => {
  it('accepts a scheduled announcement and coerces its publish date', () => {
    const result = announcementCreateBodySchema.safeParse({
      title: '新機能のお知らせ',
      body: '新しい機能を追加しました。',
      type: 'update',
      published: true,
      publishedAt: '2026-09-01T00:00:00.000Z',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.publishedAt).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    }
  });

  it('rejects blank, overly long, and unknown values', () => {
    expect(announcementCreateBodySchema.safeParse({ title: ' ', body: '本文' }).success).toBe(false);
    expect(announcementCreateBodySchema.safeParse({ title: 'タイトル', body: '本文', type: 'unknown' }).success).toBe(false);
    expect(announcementCreateBodySchema.safeParse({ title: 'タイトル', body: '本文', publishedAt: 'not-a-date' }).success).toBe(false);
    expect(announcementCreateBodySchema.safeParse({ title: 'タイトル', body: '本文', publishedAt: 0 }).success).toBe(false);
    expect(announcementCreateBodySchema.safeParse({ title: 'a'.repeat(121), body: '本文' }).success).toBe(false);
    expect(announcementCreateBodySchema.safeParse({ title: 'タイトル', body: 'a'.repeat(20001) }).success).toBe(false);
  });

  it('requires at least one field for an update', () => {
    expect(announcementUpdateBodySchema.safeParse({}).success).toBe(false);
    expect(announcementUpdateBodySchema.safeParse({ published: false }).success).toBe(true);
  });
});
