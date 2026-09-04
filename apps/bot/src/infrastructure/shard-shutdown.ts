import type { ChildProcess } from 'node:child_process';
import { logger } from './logger.js';

/** ShardingManager 配下の子プロセスへ正常終了シグナルを送り、終了を待機する。 */
export async function shutdownShardProcesses(
  processes: Iterable<ChildProcess | null>,
): Promise<void> {
  await Promise.all(Array.from(processes, shutdownShardProcess));
}

async function shutdownShardProcess(child: ChildProcess | null): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  await new Promise<void>((resolve) => {
    const finish = (): void => {
      child.off('exit', finish);
      resolve();
    };

    child.once('exit', finish);
    try {
      if (!child.kill('SIGTERM')) finish();
    } catch (error) {
      logger.warn({ err: error, pid: child.pid }, 'Failed to signal shard shutdown');
      finish();
    }
  });
}
