import { REST, Routes, type Client } from 'discord.js';
import { config } from './config.js';
import { logger } from './logger.js';

type CleanupOperation = '確認' | '削除';

const cleanupPromises = new WeakMap<Client, Promise<void>>();

export function cleanupSubBotCommands(client: Client, shardId: number): Promise<void> {
  if (config.botInstanceId <= 1 || shardId !== 0) {
    return Promise.resolve();
  }

  const existingPromise = cleanupPromises.get(client);
  if (existingPromise) {
    return existingPromise;
  }

  const cleanupPromise = runCleanup(client).catch((error: unknown) => {
    logger.warn(
      { err: error, instanceId: config.botInstanceId },
      'Unexpected failure during sub-Bot command cleanup',
    );
  });
  cleanupPromises.set(client, cleanupPromise);
  return cleanupPromise;
}

async function runCleanup(client: Client): Promise<void> {
  const route = config.deployGuildId
    ? Routes.applicationGuildCommands(config.discordClientId, config.deployGuildId)
    : Routes.applicationCommands(config.discordClientId);
  const rest = new REST({ version: '10' }).setToken(config.discordToken);

  let commandCount: number;
  try {
    const response = await rest.get(route);
    if (!Array.isArray(response)) {
      throw new Error('Discord API returned an invalid application command list');
    }
    commandCount = response.length;
  } catch (error: unknown) {
    await reportCleanupFailure(client, '確認', route, error);
    return;
  }

  if (commandCount === 0) {
    logger.info(
      { instanceId: config.botInstanceId, commandCount, deployGuildId: config.deployGuildId },
      'No sub-Bot application commands found; cleanup skipped',
    );
    return;
  }

  try {
    await rest.put(route, { body: [] });
    logger.info(
      { instanceId: config.botInstanceId, commandCount, deployGuildId: config.deployGuildId },
      'Sub-Bot application commands removed',
    );
  } catch (error: unknown) {
    await reportCleanupFailure(client, '削除', route, error);
  }
}

async function reportCleanupFailure(
  client: Client,
  operation: CleanupOperation,
  route: string,
  error: unknown,
): Promise<void> {
  logger.warn(
    {
      err: error,
      instanceId: config.botInstanceId,
      operation,
      route,
      deployGuildId: config.deployGuildId,
    },
    'Failed to clean up sub-Bot application commands',
  );

  const message = buildAdminNotification(operation, error);
  for (const userId of config.botAdminUserIds) {
    try {
      const adminUser = await client.users.fetch(userId);
      await adminUser.send(message);
    } catch (notificationError: unknown) {
      logger.warn(
        { err: notificationError, userId, instanceId: config.botInstanceId },
        'Failed to notify bot administrator',
      );
    }
  }
}

function buildAdminNotification(operation: CleanupOperation, error: unknown): string {
  const target = config.deployGuildId
    ? `ギルドコマンド (${config.deployGuildId})`
    : 'グローバルコマンド';
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';

  return [
    `サブBotのコマンド${operation}に失敗しました。`,
    `インスタンスID: ${config.botInstanceId}`,
    `対象: ${target}`,
    `エラー: ${errorMessage.slice(0, 500)}`,
  ].join('\n');
}
