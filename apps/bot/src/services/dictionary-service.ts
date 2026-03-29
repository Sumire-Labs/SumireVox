import {
  ServerDictionaryEntry,
  GlobalDictionaryEntry,
  GlobalDictionaryRequest,
  LIMITS,
  REDIS_CHANNELS,
  validateDictionaryEntry,
} from '@sumirevox/shared';
import { Prisma } from '@prisma/client';
import { getPrisma } from '../infrastructure/database.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import { invalidateGuildTrie, invalidateAllTries } from './text-pipeline/index.js';
import { logger } from '../infrastructure/logger.js';
import { AppError } from '../infrastructure/app-error.js';

// ========================================
// サーバー辞書
// ========================================

export async function getServerDictionaryEntries(
  guildId: string,
  page: number,
  perPage: number = LIMITS.DICTIONARY_PAGE_SIZE,
): Promise<{ entries: ServerDictionaryEntry[]; total: number }> {
  const prisma = getPrisma();
  const [entries, total] = await Promise.all([
    prisma.serverDictionary.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.serverDictionary.count({ where: { guildId } }),
  ]);
  return {
    entries: entries.map(mapServerEntry),
    total,
  };
}

export async function addServerDictionaryEntry(
  guildId: string,
  word: string,
  reading: string,
  registeredBy: string,
  isPremium: boolean,
): Promise<ServerDictionaryEntry> {
  const validation = validateDictionaryEntry(word, reading);
  if (!validation.valid) {
    throw new AppError('VALIDATION_ERROR', validation.error!);
  }

  const prisma = getPrisma();
  const limit = isPremium ? LIMITS.PREMIUM_DICTIONARY_ENTRIES : LIMITS.FREE_DICTIONARY_ENTRIES;
  const trimmedWord = word.trim();
  const trimmedReading = reading.trim();

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const currentCount = await tx.serverDictionary.count({ where: { guildId } });
      if (currentCount >= limit) {
        throw new AppError(
          'DICTIONARY_LIMIT_REACHED',
          `サーバー辞書のエントリ上限（${limit}件）に達しています。${!isPremium ? 'PREMIUM にアップグレードすると100件まで登録できます。' : ''}`,
        );
      }

      const existing = await tx.serverDictionary.findUnique({
        where: { guildId_word: { guildId, word: trimmedWord } },
      });
      if (existing) {
        throw new AppError('VALIDATION_ERROR', `「${trimmedWord}」は既に登録されています。`);
      }

      return tx.serverDictionary.create({
        data: { guildId, word: trimmedWord, reading: trimmedReading, registeredBy },
      });
    });

    invalidateGuildTrie(guildId);
    await publishEvent(REDIS_CHANNELS.SERVER_DICTIONARY_UPDATED, JSON.stringify({ guildId }));
    logger.info({ guildId, word: trimmedWord }, 'Server dictionary entry added');
    return mapServerEntry(entry);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError('VALIDATION_ERROR', `「${trimmedWord}」は既に登録されています。`);
    }
    throw error;
  }
}

export async function deleteServerDictionaryEntry(guildId: string, word: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.serverDictionary.delete({
    where: { guildId_word: { guildId, word } },
  });

  invalidateGuildTrie(guildId);
  await publishEvent(REDIS_CHANNELS.SERVER_DICTIONARY_UPDATED, JSON.stringify({ guildId }));
  logger.info({ guildId, word }, 'Server dictionary entry deleted');
}

// ========================================
// グローバル辞書
// ========================================

export async function getGlobalDictionaryEntries(
  page: number,
  perPage: number = LIMITS.DICTIONARY_PAGE_SIZE,
): Promise<{ entries: GlobalDictionaryEntry[]; total: number }> {
  const prisma = getPrisma();
  const [entries, total] = await Promise.all([
    prisma.globalDictionary.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.globalDictionary.count(),
  ]);
  return {
    entries: entries.map(mapGlobalEntry),
    total,
  };
}

// ========================================
// グローバル辞書申請
// ========================================

export async function createGlobalDictionaryRequest(
  word: string,
  reading: string,
  reason: string | null,
  requestedBy: string,
  guildId: string,
): Promise<GlobalDictionaryRequest> {
  const validation = validateDictionaryEntry(word, reading);
  if (!validation.valid) {
    throw new AppError('VALIDATION_ERROR', validation.error!);
  }

  const prisma = getPrisma();
  const request = await prisma.globalDictionaryRequest.create({
    data: {
      word: word.trim(),
      reading: reading.trim(),
      reason: reason?.trim() || null,
      requestedBy,
      guildId,
      status: 'PENDING',
    },
  });

  logger.info({ word: word.trim(), requestedBy }, 'Global dictionary request created');
  return mapRequestEntry(request);
}

export async function approveGlobalDictionaryRequest(requestId: string): Promise<void> {
  const prisma = getPrisma();
  const request = await prisma.globalDictionaryRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new AppError('NOT_FOUND', '申請が見つかりません。');
  }
  if (request.status !== 'PENDING') {
    throw new AppError('VALIDATION_ERROR', 'この申請は既に処理済みです。');
  }

  await prisma.$transaction([
    prisma.globalDictionaryRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' },
    }),
    prisma.globalDictionary.upsert({
      where: { word: request.word },
      create: { word: request.word, reading: request.reading, registeredBy: request.requestedBy },
      update: { reading: request.reading, registeredBy: request.requestedBy },
    }),
  ]);

  invalidateAllTries();
  await publishEvent(REDIS_CHANNELS.GLOBAL_DICTIONARY_UPDATED, JSON.stringify({}));
  logger.info({ requestId, word: request.word }, 'Global dictionary request approved');
}

export async function rejectGlobalDictionaryRequest(requestId: string): Promise<void> {
  const prisma = getPrisma();
  const request = await prisma.globalDictionaryRequest.findUnique({ where: { id: requestId } });
  if (!request) {
    throw new AppError('NOT_FOUND', '申請が見つかりません。');
  }
  if (request.status !== 'PENDING') {
    throw new AppError('VALIDATION_ERROR', 'この申請は既に処理済みです。');
  }

  await prisma.globalDictionaryRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED' },
  });

  logger.info({ requestId, word: request.word }, 'Global dictionary request rejected');
}

export async function getPendingRequests(
  page: number,
  perPage: number = LIMITS.DICTIONARY_PAGE_SIZE,
): Promise<{ requests: GlobalDictionaryRequest[]; total: number }> {
  const prisma = getPrisma();
  const [requests, total] = await Promise.all([
    prisma.globalDictionaryRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.globalDictionaryRequest.count({ where: { status: 'PENDING' } }),
  ]);
  return {
    requests: requests.map(mapRequestEntry),
    total,
  };
}

// ========================================
// マッピング関数
// ========================================

function mapServerEntry(db: {
  guildId: string;
  word: string;
  reading: string;
  registeredBy: string;
  createdAt: Date;
  updatedAt: Date;
}): ServerDictionaryEntry {
  return {
    guildId: db.guildId,
    word: db.word,
    reading: db.reading,
    registeredBy: db.registeredBy,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}

function mapGlobalEntry(db: {
  word: string;
  reading: string;
  registeredBy: string;
  createdAt: Date;
  updatedAt: Date;
}): GlobalDictionaryEntry {
  return {
    word: db.word,
    reading: db.reading,
    registeredBy: db.registeredBy,
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}

function mapRequestEntry(db: {
  id: string;
  word: string;
  reading: string;
  reason: string | null;
  requestedBy: string;
  guildId: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): GlobalDictionaryRequest {
  return {
    id: db.id,
    word: db.word,
    reading: db.reading,
    reason: db.reason,
    requestedBy: db.requestedBy,
    guildId: db.guildId,
    status: db.status as GlobalDictionaryRequest['status'],
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
  };
}
