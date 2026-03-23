import {
  ServerDictionaryEntry,
  GlobalDictionaryEntry,
  LIMITS,
  REDIS_CHANNELS,
  validateDictionaryEntry,
} from '@sumirevox/shared';
import { getPrisma } from '../infrastructure/database.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import { AppError } from '../infrastructure/app-error.js';
import { logger } from '../infrastructure/logger.js';
import { getGuildSettings } from './guild-settings-service.js';

// ========================================
// サーバー辞書
// ========================================

export async function getServerDictionaryEntries(
  guildId: string,
  page: number,
  perPage: number = 20,
): Promise<{ items: ServerDictionaryEntry[]; total: number }> {
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
  return { items: entries.map(mapServerEntry), total };
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
    throw new AppError('VALIDATION_ERROR', validation.error!, 400);
  }

  const prisma = getPrisma();
  const limit = isPremium ? LIMITS.PREMIUM_DICTIONARY_ENTRIES : LIMITS.FREE_DICTIONARY_ENTRIES;
  const currentCount = await prisma.serverDictionary.count({ where: { guildId } });
  if (currentCount >= limit) {
    throw new AppError(
      'DICTIONARY_LIMIT_REACHED',
      `サーバー辞書のエントリ上限（${limit}件）に達しています。`,
      400,
    );
  }

  const existing = await prisma.serverDictionary.findUnique({
    where: { guildId_word: { guildId, word: word.trim() } },
  });
  if (existing) {
    throw new AppError('VALIDATION_ERROR', `「${word.trim()}」は既に登録されています。`, 400);
  }

  const entry = await prisma.serverDictionary.create({
    data: { guildId, word: word.trim(), reading: reading.trim(), registeredBy },
  });

  await publishEvent(REDIS_CHANNELS.SERVER_DICTIONARY_UPDATED, JSON.stringify({ guildId }));
  logger.info({ guildId, word: word.trim() }, 'Server dictionary entry added via API');

  return mapServerEntry(entry);
}

export async function deleteServerDictionaryEntry(guildId: string, word: string): Promise<void> {
  const prisma = getPrisma();
  try {
    await prisma.serverDictionary.delete({
      where: { guildId_word: { guildId, word } },
    });
  } catch {
    throw new AppError('NOT_FOUND', '辞書エントリが見つかりません。', 404);
  }

  await publishEvent(REDIS_CHANNELS.SERVER_DICTIONARY_UPDATED, JSON.stringify({ guildId }));
  logger.info({ guildId, word }, 'Server dictionary entry deleted via API');
}

// ========================================
// グローバル辞書（閲覧のみ）
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
  return { items: entries.map(mapGlobalEntry), total };
}

// ========================================
// PREMIUM 判定
// ========================================

export async function isGuildPremium(guildId: string): Promise<boolean> {
  const settings = await getGuildSettings(guildId);
  if (settings.manualPremium) return true;

  const prisma = getPrisma();
  const activeBoost = await prisma.boost.findFirst({
    where: { guildId, subscription: { status: 'ACTIVE' } },
  });
  return activeBoost !== null;
}

// ========================================
// マッピング
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
