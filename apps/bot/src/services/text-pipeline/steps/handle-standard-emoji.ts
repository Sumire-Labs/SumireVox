import { getEmojiLabel } from '../emoji-dictionary.js';
import { PipelineStep } from '../types.js';

// Unicode絵文字にマッチする正規表現
// ZWJシーケンス（👨‍👩‍👧‍👦等）、スキンモディファイア（👍🏻等）をカバー
const EMOJI_REGEX =
  /\p{Extended_Pictographic}(\u200D\p{Extended_Pictographic}|\uFE0F|\p{Emoji_Modifier})*/gu;

export const handleStandardEmoji: PipelineStep = (text, _context) => {
  return text.replace(EMOJI_REGEX, (match) => {
    const label = getEmojiLabel(match);
    if (label) {
      return label;
    }

    // Variation Selector (U+FE0F) を除去してリトライ
    const normalized = match.replace(/\uFE0F/g, '');
    if (normalized !== match) {
      const normalizedLabel = getEmojiLabel(normalized);
      if (normalizedLabel) {
        return normalizedLabel;
      }
    }

    // 見つからない場合は空文字（絵文字を読まない）
    return '';
  });
};
