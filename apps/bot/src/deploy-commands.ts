import { REST, Routes } from 'discord.js';
import { config } from './infrastructure/config.js';
import { logger } from './infrastructure/logger.js';
import { commands } from './commands/index.js';

async function deployCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const commandData = config.botInstanceId === 1 ? commands.map((cmd) => cmd.data.toJSON()) : [];
  const action = config.botInstanceId === 1 ? 'Deploying' : 'Removing';

  if (config.deployGuildId) {
    logger.info(
      { guildId: config.deployGuildId, commandCount: commandData.length },
      `${action} guild commands...`,
    );
    await rest.put(
      Routes.applicationGuildCommands(config.discordClientId, config.deployGuildId),
      { body: commandData },
    );
    logger.info({ commandCount: commandData.length }, 'Guild commands synchronized successfully');
  } else {
    logger.info({ commandCount: commandData.length }, `${action} global commands...`);
    await rest.put(Routes.applicationCommands(config.discordClientId), { body: commandData });
    logger.info({ commandCount: commandData.length }, 'Global commands synchronized successfully');
  }
}

deployCommands().catch((error) => {
  logger.error({ err: error }, 'Failed to deploy commands');
  process.exit(1);
});
