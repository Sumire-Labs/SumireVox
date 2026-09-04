import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { shutdownShardProcesses } from '../shard-shutdown.js';

function makeShardProcess(): ChildProcess {
  const child = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
    kill: vi.fn((signal: NodeJS.Signals) => {
      queueMicrotask(() => child.emit('exit', 0, signal));
      return true;
    }),
  });
  return child as unknown as ChildProcess;
}

describe('shutdownShardProcesses', () => {
  it('全シャードへSIGTERMを送り、終了を待機する', async () => {
    const first = makeShardProcess();
    const second = makeShardProcess();

    await shutdownShardProcesses([first, second]);

    expect(first.kill).toHaveBeenCalledWith('SIGTERM');
    expect(second.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
