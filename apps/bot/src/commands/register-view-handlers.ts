import { registerViewHandler } from '../events/view-router.js';
import { handleVoiceView } from './voice-view-handler.js';
import { handleSettingsView } from './settings-view-handler.js';
import { handleDictionaryView } from './dictionary-view-handler.js';

/**
 * 全コマンドの View ハンドラを登録する
 * bot.ts の初期化時に1回呼ぶ
 */
export function registerAllViewHandlers(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerViewHandler('voice', handleVoiceView as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerViewHandler('settings', handleSettingsView as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerViewHandler('dict', handleDictionaryView as any);
}
