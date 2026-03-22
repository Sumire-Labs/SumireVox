import { registerViewHandler } from '../events/view-router.js';
import { handleVoiceView } from './voice-view-handler.js';

/**
 * 全コマンドの View ハンドラを登録する
 * bot.ts の初期化時に1回呼ぶ
 */
export function registerAllViewHandlers(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerViewHandler('voice', handleVoiceView as any);
  // 後続フェーズで settings, dictionary のハンドラも追加
}
