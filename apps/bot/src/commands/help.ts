import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandDefinition } from './types.js';

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('コマンド一覧と使い方を表示します');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Phase 4-13 で実装
  await interaction.reply({ content: 'このコマンドは現在開発中です。', ephemeral: true });
}

export const helpCommand: CommandDefinition = { data, execute };
