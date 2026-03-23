import { UserVoiceSetting, LIMITS, REDIS_CHANNELS } from '@sumirevox/shared';
import {
  getCachedUserVoiceSetting,
  setCachedUserVoiceSetting,
} from '../infrastructure/settings-cache.js';
import { publishEvent } from '../infrastructure/pubsub.js';
import { getPrisma } from '../infrastructure/database.js';

/**
 * ユーザー音声設定を取得する
 * 優先順位: Redis キャッシュ → DB → デフォルト値
 */
export async function getUserVoiceSetting(userId: string): Promise<UserVoiceSetting> {
  // 1. Redis キャッシュ
  const cached = await getCachedUserVoiceSetting(userId);
  if (cached) return cached;

  // 2. DB
  const prisma = getPrisma();
  const dbSetting = await prisma.userVoiceSetting.findUnique({
    where: { userId },
  });

  if (dbSetting) {
    const setting: UserVoiceSetting = {
      userId: dbSetting.userId,
      speakerId: dbSetting.speakerId,
      speedScale: dbSetting.speedScale,
      pitchScale: dbSetting.pitchScale,
    };
    await setCachedUserVoiceSetting(userId, setting);
    return setting;
  }

  // 3. デフォルト値
  const defaults: UserVoiceSetting = {
    userId,
    speakerId: null,
    speedScale: LIMITS.DEFAULT_SPEED_SCALE,
    pitchScale: LIMITS.DEFAULT_PITCH_SCALE,
  };
  return defaults;
}

/**
 * ユーザー音声設定を更新する（upsert）
 */
export async function updateUserVoiceSetting(
  userId: string,
  updates: Partial<Pick<UserVoiceSetting, 'speakerId' | 'speedScale' | 'pitchScale'>>,
): Promise<UserVoiceSetting> {
  const prisma = getPrisma();
  const updated = await prisma.userVoiceSetting.upsert({
    where: { userId },
    create: {
      userId,
      speakerId: updates.speakerId ?? null,
      speedScale: updates.speedScale ?? LIMITS.DEFAULT_SPEED_SCALE,
      pitchScale: updates.pitchScale ?? LIMITS.DEFAULT_PITCH_SCALE,
    },
    update: updates,
  });

  const setting: UserVoiceSetting = {
    userId: updated.userId,
    speakerId: updated.speakerId,
    speedScale: updated.speedScale,
    pitchScale: updated.pitchScale,
  };

  // キャッシュ更新
  await setCachedUserVoiceSetting(userId, setting);

  // Pub/Sub で通知
  await publishEvent(REDIS_CHANNELS.USER_VOICE_SETTING_UPDATED, JSON.stringify({ userId }));

  return setting;
}
