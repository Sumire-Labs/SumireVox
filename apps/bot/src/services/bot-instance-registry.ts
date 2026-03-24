import { getPrisma } from '../infrastructure/database.js';
import { getClient } from '../infrastructure/discord-client.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

export async function registerBotInstance(): Promise<void> {
  const client = getClient();
  const botUserId = client.user!.id;
  const name = client.user!.username;

  await getPrisma().botInstance.upsert({
    where: { instanceId: config.botInstanceId },
    create: {
      instanceId: config.botInstanceId,
      botUserId,
      clientId: config.discordClientId,
      name,
      isActive: true,
    },
    update: {
      botUserId,
      clientId: config.discordClientId,
      name,
      isActive: true,
    },
  });

  logger.info(
    { instanceId: config.botInstanceId, username: name },
    `Bot instance ${config.botInstanceId} registered (${name})`,
  );
}

export async function deactivateBotInstance(): Promise<void> {
  await getPrisma().botInstance.updateMany({
    where: { instanceId: config.botInstanceId },
    data: { isActive: false },
  });

  logger.info({ instanceId: config.botInstanceId }, 'Bot instance deactivated');
}
