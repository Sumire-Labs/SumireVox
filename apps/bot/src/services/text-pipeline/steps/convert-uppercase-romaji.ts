import { toHiragana } from 'wanakana';
import { PipelineStep } from '../types.js';

// すべて大文字の英字の連続（2文字以上）にマッチ
const UPPERCASE_PATTERN = /[A-Z]{2,}/g;

export const convertUppercaseRomaji: PipelineStep = (text, context) => {
  if (!context?.guildSettings?.uppercaseReading) return text;

  return text.replace(UPPERCASE_PATTERN, (match) => {
    try {
      const hiragana = toHiragana(match.toLowerCase());

      // 変換結果にアルファベットが残っている場合は変換失敗とみなす
      if (/[a-zA-Z]/.test(hiragana)) return match;

      return hiragana;
    } catch {
      return match;
    }
  });
};
