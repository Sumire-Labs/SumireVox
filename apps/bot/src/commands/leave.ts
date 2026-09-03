import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags, ChannelType } from 'discord.js';
import { CommandDefinition } from './types.js';
import { getVcSession } from '../services/vc-session-manager.js';
import { hasAdminPermission } from '../services/permission-service.js';
import { logger } from '../infrastructure/logger.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { REDIS_KEYS } from '@sumirevox/shared';
import { delegateBotCommand } from '../services/bot-command-delegation-service.js';

const data = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('ボイスチャンネルから退出します')
  .addChannelOption((option) => option
    .setName('voice-channel')
    .setDescription('退出させるVC（管理者がVC外の場合は必須）')
    .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice));

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

  const requestedChannel = interaction.options.getChannel('voice-channel');
  const targetVoiceChannelId = requestedChannel?.id ?? member.voice.channelId;
  const isAdmin = await hasAdminPermission(member, guildId);
  if (!targetVoiceChannelId) {
    await interaction.reply({
      content: 'VC外の管理者は `voice-channel` で退出対象を指定してください。',
      ephemeral: true,
    });
    return;
  }
  if (member.voice.channelId !== targetVoiceChannelId && !isAdmin) {
    await interaction.reply({
      content: 'Bot と同じボイスチャンネルに参加しているか、サーバーの管理権限が必要です。',
      ephemeral: true,
    });
    return;
  }

  try {
    const instanceId = await findOwningInstance(guildId, targetVoiceChannelId);
    if (!instanceId) {
      await interaction.reply({ content: '指定したVCにSumireVoxは接続していません。', ephemeral: true });
      return;
    }
    const result = await delegateBotCommand(instanceId, {
      action: 'leave', guildId, voiceChannelId: targetVoiceChannelId,
    });
    if (!result.success) {
      await interaction.reply({ content: result.message ?? '退出中にエラーが発生しました。', ephemeral: true });
      return;
    }
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

async function findOwningInstance(guildId: string, voiceChannelId: string): Promise<number | undefined> {
  const value = await getRedisClient().get(REDIS_KEYS.VC_CLAIM(guildId, voiceChannelId));
  const instanceId = value ? Number(value.split(':', 1)[0]) : Number.NaN;
  if (Number.isInteger(instanceId)) return instanceId;
  const localSession = getVcSession(guildId);
  if (localSession?.voiceChannelId === voiceChannelId) return localSession.botInstanceId;
  return undefined;
}

export const leaveCommand: CommandDefinition = { data, execute };
