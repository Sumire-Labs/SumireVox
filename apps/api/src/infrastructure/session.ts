import { REDIS_KEYS } from '@sumirevox/shared';
import { getRedisClient } from './redis.js';
import crypto from 'node:crypto';

const SESSION_TTL = 7 * 24 * 60 * 60; // 7日（秒）

export interface SessionData {
  userId: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}

/**
 * セッションを作成し、セッションIDを返す
 */
export async function createSession(data: SessionData): Promise<string> {
  const sessionId = crypto.randomUUID();
  const redis = getRedisClient();
  await redis.set(
    REDIS_KEYS.SESSION(sessionId),
    JSON.stringify(data),
    'EX',
    SESSION_TTL,
  );
  return sessionId;
}

/**
 * セッションIDからセッションデータを取得する
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
  const redis = getRedisClient();
  const data = await redis.get(REDIS_KEYS.SESSION(sessionId));
  if (!data) return null;
  try {
    return JSON.parse(data) as SessionData;
  } catch {
    return null;
  }
}

/**
 * セッションを削除する
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(REDIS_KEYS.SESSION(sessionId));
}
