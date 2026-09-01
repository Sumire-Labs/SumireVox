import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../infrastructure/config.js', () => ({
  config: { voiceDisconnectTimeoutSeconds: 1 },
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  cancelDisconnectTimer,
  clearAllDisconnectTimers,
  startDisconnectTimer,
} from '../auto-disconnect-timer.js';

describe('auto-disconnect-timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllDisconnectTimers();
  });

  afterEach(() => {
    clearAllDisconnectTimers();
    vi.useRealTimers();
  });

  it('同一ギルドではタイマーを重複開始せず、満了時にcallbackを呼ぶ', async () => {
    const handler = vi.fn();

    startDisconnectTimer('guild-1', handler);
    startDisconnectTimer('guild-1', handler);
    await vi.advanceTimersByTimeAsync(999);
    expect(handler).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith('guild-1');
  });

  it('タイマーをキャンセルするとcallbackを呼ばない', async () => {
    const handler = vi.fn();

    startDisconnectTimer('guild-1', handler);
    cancelDisconnectTimer('guild-1');
    await vi.advanceTimersByTimeAsync(1_000);

    expect(handler).not.toHaveBeenCalled();
  });
});
