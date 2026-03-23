import { destroyVcSession } from './vc-session-manager.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

// guildId → タイマーID
const timers = new Map<string, NodeJS.Timeout>();

/**
 * 自動退出タイマーを開始する
 * 既にタイマーが動いている場合は何もしない
 */
export function startDisconnectTimer(guildId: string): void {
  if (timers.has(guildId)) return;

  const timeoutMs = config.voiceDisconnectTimeoutSeconds * 1000;
  const timer = setTimeout(async () => {
    timers.delete(guildId);
    logger.info({ guildId }, 'Auto-disconnect timer expired, leaving VC');
    try {
      await destroyVcSession(guildId);
    } catch (error) {
      logger.error({ err: error, guildId }, 'Failed to auto-disconnect');
    }
  }, timeoutMs);

  timers.set(guildId, timer);
  logger.debug(
    { guildId, timeoutSeconds: config.voiceDisconnectTimeoutSeconds },
    'Auto-disconnect timer started',
  );
}

/**
 * 自動退出タイマーをキャンセルする
 * 誰かが VC に戻ってきた場合に呼ぶ
 */
export function cancelDisconnectTimer(guildId: string): void {
  const timer = timers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(guildId);
    logger.debug({ guildId }, 'Auto-disconnect timer cancelled');
  }
}

/**
 * 全タイマーをクリアする（Graceful Shutdown 用）
 */
export function clearAllDisconnectTimers(): void {
  for (const [, timer] of timers) {
    clearTimeout(timer);
  }
  timers.clear();
}
