import { config as dotenvConfig } from 'dotenv';
import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';
import { logger } from './infrastructure/logger.js';

dotenvConfig({ path: '../../.env' });

interface CommandApplication {
  instanceId: number;
  token: string;
  clientId: string;
}

function getConfiguredApplications(): CommandApplication[] {
  const applications: CommandApplication[] = [];
  for (let instanceId = 1; instanceId <= 5; instanceId += 1) {
    const token = process.env[`DISCORD_TOKEN_${instanceId}`];
    const clientId = process.env[`DISCORD_CLIENT_ID_${instanceId}`];
    if (!token && !clientId) continue;
    if (!token || !clientId) {
      throw new Error(`DISCORD_TOKEN_${instanceId} と DISCORD_CLIENT_ID_${instanceId} は対で設定してください。`);
    }
    applications.push({ instanceId, token, clientId });
  }
  if (!applications.some((application) => application.instanceId === 1)) {
    throw new Error('Bot 1のDiscord認証情報が必要です。');
  }
  return applications;
}

async function syncCommands(): Promise<void> {
  const applications = getConfiguredApplications();
  const deployGuildId = process.env['DEPLOY_GUILD_ID'];
  const primaryCommands = commands.map((command) => command.data.toJSON());

  for (const application of applications) {
    const body = application.instanceId === 1 ? primaryCommands : [];
    const rest = new REST({ version: '10' }).setToken(application.token);
    const route = deployGuildId
      ? Routes.applicationGuildCommands(application.clientId, deployGuildId)
      : Routes.applicationCommands(application.clientId);
    await rest.put(route, { body });
    logger.info(
      { instanceId: application.instanceId, commandCount: body.length, deployGuildId },
      'Application commands synchronized',
    );
  }
}

syncCommands().catch((error) => {
  logger.error({ err: error }, 'Failed to synchronize application commands');
  process.exit(1);
});
