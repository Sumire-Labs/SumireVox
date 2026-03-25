import { PipelineStep, PipelineContext } from './types.js';
import { removeReplyMention } from './steps/remove-reply-mention.js';
import { removeCodeBlock } from './steps/remove-code-block.js';
import { removeInlineCode } from './steps/remove-inline-code.js';
import { removeSpoiler } from './steps/remove-spoiler.js';
import { removeUrl } from './steps/remove-url.js';
import { convertTimestamp } from './steps/convert-timestamp.js';
import { handleCustomEmoji } from './steps/handle-custom-emoji.js';
import { handleStandardEmoji } from './steps/handle-standard-emoji.js';
import { convertUserMention } from './steps/convert-user-mention.js';
import { convertRoleMention } from './steps/convert-role-mention.js';
import { convertChannelMention } from './steps/convert-channel-mention.js';
import { applyDictionary } from './steps/apply-dictionary.js';
import { convertWKusa } from './steps/convert-w-kusa.js';
import { optimizeNumbersAndUnits } from './steps/optimize-numbers-and-units.js';
import { handleRomaji } from './steps/handle-romaji.js';
import { clampReadLength } from '@sumirevox/shared';
import { truncateForSpeech } from './truncate.js';

// パイプラインステップの順序（厳守）
const pipelineSteps: PipelineStep[] = [
  removeReplyMention,      // 1. リプライメンション除去
  removeCodeBlock,         // 2. コードブロック除去
  removeInlineCode,        // 3. インラインコード除去
  removeSpoiler,           // 4. スポイラー除去
  removeUrl,               // 5. URL除去
  convertTimestamp,        // 6. タイムスタンプ変換
  handleCustomEmoji,       // 7. カスタム絵文字
  handleStandardEmoji,     // 7.5. 標準絵文字 → 日本語ラベル
  convertUserMention,      // 8. ユーザーメンション変換
  convertRoleMention,      // 9. ロールメンション変換
  convertChannelMention,   // 10. チャンネルメンション変換
  applyDictionary,         // 11. 辞書変換
  convertWKusa,            // 12. w/草変換
  optimizeNumbersAndUnits, // 13. 英数字最適化
  handleRomaji,            // 14. ローマ字読み
];

/**
 * テキスト前処理パイプラインを実行する
 * @param text 元のメッセージテキスト
 * @param context パイプラインコンテキスト
 * @param isPremium サーバーが PREMIUM かどうか
 * @returns 変換後のテキスト。空文字列の場合は読み上げをスキップすべき
 */
export function runPipeline(
  text: string,
  context: PipelineContext,
  isPremium: boolean,
): string {
  let result = text;
  for (const step of pipelineSteps) {
    result = step(result, context);
  }

  // 前後の空白をトリム
  result = result.trim();

  // 最大文字数でクランプ
  const maxLength = clampReadLength(context.guildSettings.maxReadLength, isPremium);
  return truncateForSpeech(result, maxLength, '以下省略');
}
