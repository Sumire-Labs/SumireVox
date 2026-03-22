// ShardingManager でシャードを管理するエントリポイント
// このファイルがメインプロセスとして動作し、bot.ts を子プロセスとして spawn する
import { ShardingManager } from 'discord.js';
import { resolve } from 'node:path';
import { config } from './infrastructure/config.js';
import { logger } from './infrastructure/logger.js';

function main(): void {
  const manager = new ShardingManager(resolve(__dirname, 'bot.ts'), {
    token: config.discordToken,
    totalShards: 'auto',
  });

  // tsx で src/index.ts を実行する場合、__dirname は正しく解決される。
  // ShardingManager が子プロセスを fork する際には、親プロセスと同じ execArgv が
  // 引き継がれるため、tsx の --import フックが子プロセスにも適用される。

  manager.on('shardCreate', (shard) => {
    logger.info({ shardId: shard.id }, `Shard ${shard.id} launched`);

    shard.on('ready', () => {
      logger.info({ shardId: shard.id }, `Shard ${shard.id} ready`);
    });

    shard.on('disconnect', () => {
      logger.warn({ shardId: shard.id }, `Shard ${shard.id} disconnected`);
    });

    shard.on('reconnecting', () => {
      logger.info({ shardId: shard.id }, `Shard ${shard.id} reconnecting`);
    });

    shard.on('death', (proc) => {
      const pid = 'pid' in proc ? proc.pid : undefined;
      logger.error({ shardId: shard.id, pid }, `Shard ${shard.id} died`);
    });

    shard.on('error', (error) => {
      logger.error({ shardId: shard.id, err: error }, `Shard ${shard.id} error`);
    });
  });

  manager.spawn({ timeout: 30000 }).catch((error) => {
    logger.fatal({ err: error }, 'Failed to spawn shards');
    process.exit(1);
  });
}

main();
