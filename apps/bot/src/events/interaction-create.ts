import { Interaction } from 'discord.js';
import { commands } from '../commands/index.js';
import { logger } from '../infrastructure/logger.js';
import { routeViewInteraction } from './view-router.js';

const commandMap = new Map(commands.map((cmd) => [cmd.data.name, cmd]));

export async function handleInteractionCreate(interaction: Interaction): Promise<void> {
  if (interaction.isChatInputCommand()) {
    const command = commandMap.get(interaction.commandName);
    if (!command) {
      logger.warn({ commandName: interaction.commandName }, 'Unknown command');
      return;
    }
    try {
      await command.execute(interaction);
    } catch (error) {
      logger.error(
        {
          err: error,
          commandName: interaction.commandName,
          userId: interaction.user.id,
          guildId: interaction.guildId,
        },
        'Command execution error',
      );
      const errorMessage = 'コマンドの実行中にエラーが発生しました。';
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
      }
    }
    return;
  }

  if (
    interaction.isButton() ||
    interaction.isStringSelectMenu() ||
    interaction.isModalSubmit() ||
    interaction.isRoleSelectMenu() ||
    interaction.isChannelSelectMenu()
  ) {
    await routeViewInteraction(interaction);
    return;
  }
}
