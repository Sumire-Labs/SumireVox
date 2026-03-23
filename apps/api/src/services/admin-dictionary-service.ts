import { GlobalDictionaryEntry, GlobalDictionaryRequest, REDIS_CHANNELS, validateDictionaryEntry } from '@sumirevox/shared';
import { getPrisma } from '../infrastructure/database.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import { AppError } from '../infrastructure/app-error.js';
import { logger } from '../infrastructure/logger.js';

// ========================================
// グローバル辞書管理
// ========================================

export async function getGlobalDictionaryEntries(
  page: number,
  perPage: number = 20,
): Promise<{ items: GlobalDictionaryEntry[]; total: number }> {
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
    items: entries.map((e) => ({
      word: e.word,
      reading: e.reading,
      registeredBy: e.registeredBy,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    })),
    total,
  };
}

export async function addGlobalDictionaryEntry(
  word: string,
  reading: string,
  registeredBy: string,
): Promise<GlobalDictionaryEntry> {
  const validation = validateDictionaryEntry(word, reading);
  if (!validation.valid) {
    throw new AppError('VALIDATION_ERROR', validation.error!, 400);
  }
  const prisma = getPrisma();
  const existing = await prisma.globalDictionary.findUnique({
    where: { word: word.trim() },
  });
  if (existing) {
    throw new AppError('VALIDATION_ERROR', `「${word.trim()}」は既に登録されています。`, 400);
  }
  const entry = await prisma.globalDictionary.create({
    data: { word: word.trim(), reading: reading.trim(), registeredBy },
  });
  await publishEvent(REDIS_CHANNELS.GLOBAL_DICTIONARY_UPDATED, JSON.stringify({}));
  logger.info({ word: word.trim() }, 'Global dictionary entry added');
  return {
    word: entry.word,
    reading: entry.reading,
    registeredBy: entry.registeredBy,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export async function updateGlobalDictionaryEntry(
  word: string,
  reading: string,
): Promise<GlobalDictionaryEntry> {
  const validation = validateDictionaryEntry(word, reading);
  if (!validation.valid) {
    throw new AppError('VALIDATION_ERROR', validation.error!, 400);
  }
  const prisma = getPrisma();
  try {
    const entry = await prisma.globalDictionary.update({
      where: { word },
      data: { reading: reading.trim() },
    });
    await publishEvent(REDIS_CHANNELS.GLOBAL_DICTIONARY_UPDATED, JSON.stringify({}));
    logger.info({ word }, 'Global dictionary entry updated');
    return {
      word: entry.word,
      reading: entry.reading,
      registeredBy: entry.registeredBy,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  } catch {
    throw new AppError('NOT_FOUND', '辞書エントリが見つかりません。', 404);
  }
}

export async function deleteGlobalDictionaryEntry(word: string): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.globalDictionary.delete({ where: { word } });
  } catch {
    throw new AppError('NOT_FOUND', '辞書エントリが見つかりません。', 404);
  }
  await publishEvent(REDIS_CHANNELS.GLOBAL_DICTIONARY_UPDATED, JSON.stringify({}));
  logger.info({ word }, 'Global dictionary entry deleted');
}

// ========================================
// グローバル辞書申請管理
// ========================================

export async function getGlobalDictionaryRequests(
  page: number,
  perPage: number = 20,
  status?: string,
): Promise<{ items: GlobalDictionaryRequest[]; total: number }> {
  const prisma = getPrisma();
  const where = status ? { status } : {};
  const [requests, total] = await Promise.all([
    prisma.globalDictionaryRequest.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.globalDictionaryRequest.count({ where }),
  ]);
  return {
    items: requests.map((r) => ({
      id: r.id,
      word: r.word,
      reading: r.reading,
      reason: r.reason,
      requestedBy: r.requestedBy,
      guildId: r.guildId,
      status: r.status as GlobalDictionaryRequest['status'],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
    total,
  };
}

export async function approveRequest(requestId: string): Promise<void> {
  const prisma = getPrisma();
  const request = await prisma.globalDictionaryRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new AppError('NOT_FOUND', '申請が見つかりません。', 404);
  }
  if (request.status !== 'PENDING') {
    throw new AppError('VALIDATION_ERROR', 'この申請は既に処理済みです。', 400);
  }
  await prisma.$transaction([
    prisma.globalDictionaryRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' },
    }),
    prisma.globalDictionary.upsert({
      where: { word: request.word },
      create: {
        word: request.word,
        reading: request.reading,
        registeredBy: request.requestedBy,
      },
      update: {
        reading: request.reading,
        registeredBy: request.requestedBy,
      },
    }),
  ]);
  await publishEvent(REDIS_CHANNELS.GLOBAL_DICTIONARY_UPDATED, JSON.stringify({}));
  logger.info({ requestId, word: request.word }, 'Global dictionary request approved via API');
}

export async function rejectRequest(requestId: string): Promise<void> {
  const prisma = getPrisma();
  const request = await prisma.globalDictionaryRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) {
    throw new AppError('NOT_FOUND', '申請が見つかりません。', 404);
  }
  if (request.status !== 'PENDING') {
    throw new AppError('VALIDATION_ERROR', 'この申請は既に処理済みです。', 400);
  }
  await prisma.globalDictionaryRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED' },
  });
  logger.info({ requestId, word: request.word }, 'Global dictionary request rejected via API');
}
