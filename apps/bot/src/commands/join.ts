import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { CommandDefinition } from './types.js';

const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('ボイスチャンネルに参加し、このチャンネルを読み上げ対象にします');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  // TODO: Phase 4-13 で実装
  await interaction.reply({ content: 'このコマンドは現在開発中です。', ephemeral: true });
}

export const joinCommand: CommandDefinition = { data, execute };
