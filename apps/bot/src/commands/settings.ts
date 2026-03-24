import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  GuildMember,
  MessageFlags,
} from 'discord.js';
import { CommandDefinition } from './types.js';
import { hasAdminPermission } from '../services/permission-service.js';
import { getGuildSettings, getInstanceSettings } from '../services/guild-settings-service.js';
import { buildSettingsMessage } from './settings-view-handler.js';
import { getClient } from '../infrastructure/discord-client.js';
import { config } from '../infrastructure/config.js';

const data = new SlashCommandBuilder()
  .setName('settings')
  .setDescription('サーバー設定を管理します');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;

  const isAdmin = await hasAdminPermission(member, guildId);
  if (!isAdmin) {
    await interaction.reply({
      content: 'このコマンドを実行するにはサーバーの管理権限が必要です。',
      ephemeral: true,
    });
    return;
  }

  const settings = await getGuildSettings(guildId);
  const instanceSettings = getInstanceSettings(settings, config.botInstanceId);
  const botName = getClient().user?.username ?? 'SumireVox';
  const { components } = buildSettingsMessage(settings, 'reading', interaction.user.id, instanceSettings, botName);
  await interaction.reply({ components, flags: MessageFlags.IsComponentsV2 });
}

export const settingsCommand: CommandDefinition = { data, execute };
