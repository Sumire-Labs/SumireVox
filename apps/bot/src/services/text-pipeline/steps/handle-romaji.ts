import { toHiragana } from 'wanakana';
import { PipelineStep } from '../types.js';
import { logger } from '../../../infrastructure/logger.js';

// 英字の連続（1文字以上）にマッチする正規表現
const ROMAJI_PATTERN = /[a-zA-Z]+/g;

export const handleRomaji: PipelineStep = (text, context) => {
  // romajiRead ON 時はそのまま残す（VOICEVOX がローマ字を読む）
  if (!(context?.guildSettings?.romajiReading)) return text;

  return text.replace(ROMAJI_PATTERN, (match) => {
    // 1文字の英字はスキップ（a, I 等は変換しない）
    if (match.length === 1) return match;

    // 全て大文字の場合はスキップ（略語: API, URL, OK 等）
    if (match === match.toUpperCase()) return match;

    try {
      const hiragana = toHiragana(match);

      // 変換結果にアルファベットが残っている場合は変換失敗とみなす
      if (/[a-zA-Z]/.test(hiragana)) return match;

      return hiragana;
    } catch {
      return match;
    }
  });
};
