import { synthesizeSpeech } from './speech-synthesizer.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

// キャッシュ: `${speakerId}:${text}` → Buffer
const audioCache = new Map<string, Buffer>();

/**
 * Bot 起動時に定型文を事前合成する
 * デフォルト話者IDで合成する。
 */
export async function preloadPredefinedAudio(): Promise<void> {
  const speakerId = config.defaultSpeakerId;
  const texts = ['接続しました', 'が参加しました', 'が退出しました'];

  const results = await Promise.allSettled(
    texts.map(async (text) => {
      const buffer = await synthesizeSpeech(text, speakerId, 1.0, 0.0);
      if (buffer) {
        audioCache.set(`${speakerId}:${text}`, buffer);
      }
    }),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  logger.info({ succeeded, total: texts.length }, 'Predefined audio preloaded');
}

/**
 * 定型文の音声を取得する
 * キャッシュにあればそれを返す。なければ合成してキャッシュに追加。
 * @returns Buffer、取得に失敗した場合は null
 */
export async function getPredefinedAudio(
  text: string,
  speakerId: number,
  speedScale: number,
  pitchScale: number,
): Promise<Buffer | null> {
  const key = `${speakerId}:${text}`;
  const cached = audioCache.get(key);
  if (cached) return cached;

  const buffer = await synthesizeSpeech(text, speakerId, speedScale, pitchScale);
  if (buffer) {
    audioCache.set(key, buffer);
  }
  return buffer;
}

/**
 * 特定の話者のキャッシュをクリアする（話者設定変更時）
 */
export function clearCacheForSpeaker(speakerId: number): void {
  for (const key of audioCache.keys()) {
    if (key.startsWith(`${speakerId}:`)) {
      audioCache.delete(key);
    }
  }
}

/**
 * 全キャッシュをクリアする
 */
export function clearAllPredefinedAudio(): void {
  audioCache.clear();
}
