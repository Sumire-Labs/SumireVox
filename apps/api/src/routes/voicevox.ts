import { Hono } from 'hono';
import { requireAuth } from '../middleware/require-auth.js';
import { AppError } from '../infrastructure/app-error.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';
import { config } from '../infrastructure/config.js';

const SPEAKERS_CACHE_TTL = 3600;
const speakersCacheKey = 'voicevox:speakers';

interface VoicevoxStyle {
  id: number;
  name: string;
}

interface VoicevoxSpeaker {
  name: string;
  styles: VoicevoxStyle[];
}

export const voicevoxRouter = new Hono();

voicevoxRouter.use('*', requireAuth);

/**
 * GET /api/voicevox/speakers
 * VOICEVOX 話者一覧 (id + 表示名)
 */
voicevoxRouter.get('/speakers', async (c) => {
  const redis = getRedisClient();

  const cached = await redis.get(speakersCacheKey);
  if (cached) {
    return c.json({ success: true, data: JSON.parse(cached) as unknown });
  }

  const voicevoxUrl = config.voicevoxUrls[0] ?? 'http://voicevox:50021';

  let response: Response;
  try {
    response = await fetch(`${voicevoxUrl}/speakers`, {
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to connect to VOICEVOX engine');
    throw new AppError('VOICEVOX_ERROR', 'VOICEVOX エンジンに接続できませんでした', 503);
  }

  if (!response.ok) {
    logger.error({ status: response.status }, 'VOICEVOX /speakers returned error');
    throw new AppError('VOICEVOX_ERROR', 'VOICEVOX エンジンから話者一覧を取得できませんでした', 503);
  }

  const speakers = (await response.json()) as VoicevoxSpeaker[];

  const result = speakers.flatMap((speaker) =>
    speaker.styles.map((style) => ({
      id: style.id,
      name: `${speaker.name} (${style.name})`,
    })),
  );

  await redis.set(speakersCacheKey, JSON.stringify(result), 'EX', SPEAKERS_CACHE_TTL);

  return c.json({ success: true, data: result });
});
