// ShardingManager でシャードを管理するエントリポイント
// このファイルがメインプロセスとして動作し、bot.ts を子プロセスとして spawn する
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, '..', '..', '..', '.env') });

import { ShardingManager } from 'discord.js';
import { config } from './infrastructure/config.js';
import { logger } from './infrastructure/logger.js';

function main(): void {
  const jsEntry = resolve(__dirname, 'bot.js');
  const tsEntry = resolve(__dirname, 'bot.ts');
  const botEntry = existsSync(jsEntry) ? jsEntry : tsEntry;
  const isTs = botEntry.endsWith('.ts');

  logger.info({ botEntry, isTs }, 'Resolving shard entry point');

  const manager = new ShardingManager(botEntry, {
    token: config.discordToken,
    totalShards: 'auto',
    execArgv: isTs ? ['--import', 'tsx'] : [],
  });

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

  manager.spawn({ timeout: 30_000 }).catch((error) => {
    logger.fatal({ err: error }, 'Failed to spawn shards');
    process.exit(1);
  });
}

main();
