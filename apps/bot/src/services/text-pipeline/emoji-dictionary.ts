import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

interface CompactEmoji {
  unicode: string;
  label: string;
  skins?: CompactEmoji[];
}

// unicode文字列 → 日本語ラベルのマップ
const emojiToLabel = new Map<string, string>();

function registerEmoji(emoji: CompactEmoji): void {
  if (emoji.unicode && emoji.label) {
    emojiToLabel.set(emoji.unicode, emoji.label);
  }
  if (emoji.skins) {
    for (const skin of emoji.skins) {
      registerEmoji(skin);
    }
  }
}

const compactData = require('emojibase-data/ja/compact.json') as CompactEmoji[];
for (const emoji of compactData) {
  registerEmoji(emoji);
}

/**
 * 絵文字の日本語ラベルを取得する。見つからなければ undefined。
 */
export function getEmojiLabel(emoji: string): string | undefined {
  return emojiToLabel.get(emoji);
}

/**
 * 登録済み絵文字数を返す（テスト・デバッグ用）。
 */
export function getEmojiCount(): number {
  return emojiToLabel.size;
}
