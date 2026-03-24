import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { CommandDefinition } from './types.js';
import { destroyVcSession, getVcSession } from '../services/vc-session-manager.js';
import { hasAdminPermission } from '../services/permission-service.js';
import { logger } from '../infrastructure/logger.js';

const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('ボイスチャンネルから退出します')
  .setDMPermission(false);

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;

  // Bot が VC に接続しているか確認
  const session = getVcSession(guildId);
  if (!session) {
    await interaction.reply({
      content: 'ボイスチャンネルに接続していません。',
      ephemeral: true,
    });
    return;
  }

  // 権限チェック: VC に参加中か、ManageGuild 権限 or 管理ロールを持つか
  const isInSameVc = member.voice.channelId === session.voiceChannelId;
  const isAdmin = await hasAdminPermission(member, guildId);

  if (!isInSameVc && !isAdmin) {
    await interaction.reply({
      content: 'Bot と同じボイスチャンネルに参加しているか、サーバーの管理権限が必要です。',
      ephemeral: true,
    });
    return;
  }

  try {
    await destroyVcSession(guildId);
    await interaction.reply({
      content: 'ボイスチャンネルから退出しました。',
    });
  } catch (error) {
    logger.error({ err: error, guildId }, 'Failed to leave VC');
    await interaction.reply({
      content: '退出中にエラーが発生しました。',
      ephemeral: true,
    });
  }
}

export const leaveCommand: CommandDefinition = { data, execute };
