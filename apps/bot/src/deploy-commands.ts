import { REST, Routes } from 'discord.js';
import { config } from './infrastructure/config.js';
import { logger } from './infrastructure/logger.js';
import { commands } from './commands/index.js';

async function deployCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  const commandData = commands.map((cmd) => cmd.data.toJSON());

  if (config.deployGuildId) {
    logger.info(
      { guildId: config.deployGuildId, commandCount: commandData.length },
      'Deploying guild commands...',
    );
    await rest.put(
      Routes.applicationGuildCommands(config.discordClientId, config.deployGuildId),
      { body: commandData },
    );
    logger.info('Guild commands deployed successfully');
  } else {
    logger.info({ commandCount: commandData.length }, 'Deploying global commands...');
    await rest.put(Routes.applicationCommands(config.discordClientId), { body: commandData });
    logger.info('Global commands deployed successfully');
  }
}

deployCommands().catch((error) => {
  logger.error({ err: error }, 'Failed to deploy commands');
  process.exit(1);
});
