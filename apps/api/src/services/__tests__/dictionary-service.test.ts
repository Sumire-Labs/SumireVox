import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const { prismaMock, pubsubMock, loggerMock, getGuildSettingsMock } = vi.hoisted(() => ({
  prismaMock: {
    serverDictionary: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
  },
  pubsubMock: {
    publishEvent: vi.fn(),
  },
  getGuildSettingsMock: vi.fn(),
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../../infrastructure/pubsub.js', () => ({
  publishEvent: pubsubMock.publishEvent,
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

vi.mock('../guild-settings-service.js', () => ({
  getGuildSettings: getGuildSettingsMock,
}));

import { addServerDictionaryEntry, deleteServerDictionaryEntry } from '../dictionary-service.js';

function makePrismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('db error', {
    code,
    clientVersion: '6.19.2',
  });
}

describe('dictionary-service', () => {
  beforeEach(() => {
    prismaMock.serverDictionary.count.mockReset();
    prismaMock.serverDictionary.findUnique.mockReset();
    prismaMock.serverDictionary.create.mockReset();
    prismaMock.serverDictionary.delete.mockReset();
    pubsubMock.publishEvent.mockReset();
    getGuildSettingsMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
  });

  it('adds an entry: counts below limit and no existing entry', async () => {
    prismaMock.serverDictionary.count.mockResolvedValue(0);
    prismaMock.serverDictionary.findUnique.mockResolvedValue(null);
    prismaMock.serverDictionary.create.mockResolvedValue({
      guildId: 'guild-1',
      word: 'テスト',
      reading: 'テスト',
      registeredBy: 'user-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });

    const entry = await addServerDictionaryEntry('guild-1', 'テスト', 'テスト', 'user-1', false);

    expect(entry.word).toBe('テスト');
    expect(prismaMock.serverDictionary.create).toHaveBeenCalled();
  });

  it.each([
    [29, false, true],
    [30, false, false],
    [299, true, true],
    [300, true, false],
  ])('enforces the %s-entry %s limit at the boundary', async (currentCount, isPremium, succeeds) => {
    prismaMock.serverDictionary.count.mockResolvedValue(currentCount);
    prismaMock.serverDictionary.findUnique.mockResolvedValue(null);
    prismaMock.serverDictionary.create.mockResolvedValue({
      guildId: 'guild-1',
      word: 'テスト',
      reading: 'テスト',
      registeredBy: 'user-1',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });

    const result = await addServerDictionaryEntry('guild-1', 'テスト', 'テスト', 'user-1', isPremium).catch(
      (error: unknown) => error,
    );

    if (succeeds) {
      expect(result).toMatchObject({ word: 'テスト' });
    } else {
      expect(result).toMatchObject({ code: 'DICTIONARY_LIMIT_REACHED', statusCode: 400 });
    }
  });

  it('rethrows a duplicate-create race (P2002) as VALIDATION_ERROR', async () => {
    prismaMock.serverDictionary.count.mockResolvedValue(0);
    prismaMock.serverDictionary.findUnique.mockResolvedValue(null);
    prismaMock.serverDictionary.create.mockRejectedValue(makePrismaError('P2002'));

    const error = await addServerDictionaryEntry('guild-1', 'テスト', 'テスト', 'user-1', false).catch(
      (e: unknown) => e,
    );

    expect(error).toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
  });

  it('rethrows a missing delete (P2025) as NOT_FOUND', async () => {
    prismaMock.serverDictionary.delete.mockRejectedValue(makePrismaError('P2025'));

    const error = await deleteServerDictionaryEntry('guild-1', 'test').catch((e: unknown) => e);

    expect(error).toMatchObject({ code: 'NOT_FOUND', statusCode: 404 });
  });

  it('rethrows non-P2025 errors from delete instead of masking as NOT_FOUND', async () => {
    prismaMock.serverDictionary.delete.mockRejectedValue(new Error('db down'));

    await expect(deleteServerDictionaryEntry('guild-1', 'test')).rejects.toThrow('db down');
  });
});
