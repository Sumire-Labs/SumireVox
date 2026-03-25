import { SlashCommandBuilder, ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { CommandDefinition } from './types.js';
import { buildDictionaryMessage } from './dictionary-view-handler.js';

const data = new SlashCommandBuilder()
  .setName('dictionary')
  .setDescription('辞書を管理します')
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const guildId = interaction.guildId!;
  const userId = interaction.user.id;
  const { components } = await buildDictionaryMessage(guildId, userId, 'server', 1);
  await interaction.reply({ components, flags: MessageFlags.IsComponentsV2 });
}

export const dictionaryCommand: CommandDefinition = { data, execute };
