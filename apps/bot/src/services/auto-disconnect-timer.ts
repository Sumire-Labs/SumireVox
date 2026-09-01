import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

// guildId → タイマーID
const timers = new Map<string, TimerEntry>();

export type DisconnectTimerHandler = (guildId: string) => Promise<void> | void;

interface TimerEntry {
  timeout: NodeJS.Timeout;
  handler: DisconnectTimerHandler;
}

/**
 * 自動退出タイマーを開始する
 * 既にタイマーが動いている場合は何もしない
 */
export function startDisconnectTimer(
  guildId: string,
  handler: DisconnectTimerHandler = runLegacyDisconnect,
): void {
  if (timers.has(guildId)) return;

  const timeoutMs = config.voiceDisconnectTimeoutSeconds * 1000;
  const entry: TimerEntry = {
    timeout: setTimeout(async () => {
      if (timers.get(guildId) !== entry) return;

      timers.delete(guildId);
      logger.info({ guildId }, 'Auto-disconnect timer expired');
      try {
        await handler(guildId);
      } catch (error) {
        logger.error({ err: error, guildId }, 'Failed to handle auto-disconnect timer');
      }
    }, timeoutMs),
    handler,
  };

  timers.set(guildId, entry);
  logger.debug(
    { guildId, timeoutSeconds: config.voiceDisconnectTimeoutSeconds },
    'Auto-disconnect timer started',
  );
}

async function runLegacyDisconnect(guildId: string): Promise<void> {
  const { destroyVcSession } = await import('./vc-session-manager.js');
  await destroyVcSession(guildId);
}

/**
 * 自動退出タイマーをキャンセルする
 * 誰かが VC に戻ってきた場合に呼ぶ
 */
export function cancelDisconnectTimer(guildId: string): void {
  const entry = timers.get(guildId);
  if (entry) {
    clearTimeout(entry.timeout);
    timers.delete(guildId);
    logger.debug({ guildId }, 'Auto-disconnect timer cancelled');
  }
}

/**
 * 全タイマーをクリアする（Graceful Shutdown 用）
 */
export function clearAllDisconnectTimers(): void {
  for (const entry of timers.values()) {
    clearTimeout(entry.timeout);
  }
  timers.clear();
}
