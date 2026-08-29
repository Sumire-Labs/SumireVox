import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, publishEventMock, invalidateGuildTrieMock, loggerMock } = vi.hoisted(() => ({
  prismaMock: {
    $transaction: vi.fn(),
    serverDictionary: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
  publishEventMock: vi.fn(),
  invalidateGuildTrieMock: vi.fn(),
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
  publishEvent: publishEventMock,
}));

vi.mock('../text-pipeline/index.js', () => ({
  invalidateGuildTrie: invalidateGuildTrieMock,
  invalidateAllTries: vi.fn(),
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

import { addServerDictionaryEntry } from '../dictionary-service.js';

const createdEntry = {
  guildId: 'guild-1',
  word: 'テスト',
  reading: 'テスト',
  registeredBy: 'user-1',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('bot dictionary-service', () => {
  beforeEach(() => {
    prismaMock.$transaction.mockReset().mockImplementation(async (callback) => callback(prismaMock));
    prismaMock.serverDictionary.count.mockReset();
    prismaMock.serverDictionary.findUnique.mockReset().mockResolvedValue(null);
    prismaMock.serverDictionary.create.mockReset().mockResolvedValue(createdEntry);
    publishEventMock.mockReset().mockResolvedValue(undefined);
    invalidateGuildTrieMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
  });

  it.each([
    [29, false, true],
    [30, false, false],
    [299, true, true],
    [300, true, false],
  ])('enforces the %s-entry %s limit at the boundary', async (currentCount, isPremium, succeeds) => {
    prismaMock.serverDictionary.count.mockResolvedValue(currentCount);

    const result = await addServerDictionaryEntry('guild-1', 'テスト', 'テスト', 'user-1', isPremium).catch(
      (error: unknown) => error,
    );

    if (succeeds) {
      expect(result).toMatchObject({ word: 'テスト' });
    } else {
      expect(result).toMatchObject({ code: 'DICTIONARY_LIMIT_REACHED' });
    }
  });
});
