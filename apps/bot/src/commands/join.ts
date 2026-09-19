import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { CommandDefinition } from './types.js';
import { logger } from '../infrastructure/logger.js';
import {
  allocateVoiceConnection,
  inspectVoiceConnectionAllocation,
} from '../services/vc-allocation-service.js';

const CAPACITY_ERROR_MESSAGE = '利用可能なBotがすべて別のVCで使用中です。';

const data = new SlashCommandBuilder()
  .setName('join')
  .setDescription('ボイスチャンネルに参加し、このチャンネルを読み上げ対象にします')
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
  const textChannelId = interaction.channelId;

  // ユーザーが VC に参加しているか確認
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({
      content: 'ボイスチャンネルに参加してからコマンドを実行してください。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let deferred = false;
  try {
    // 容量不足はdefer前に判定し、Interaction自体をEphemeralで返せるようにする。
    const inspection = await inspectVoiceConnectionAllocation(guildId, voiceChannel.id);
    if (inspection.status === 'capacity') {
      await interaction.reply({
        content: CAPACITY_ERROR_MESSAGE,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply();
    deferred = true;
    const result = await allocateVoiceConnection({
      guildId,
      voiceChannelId: voiceChannel.id,
      textChannelId,
      connectionMode: 'manual',
      existingOwnerBehavior: 'update',
    });

    if (result.status === 'capacity') {
      // 事前判定後に競合した場合は、公開defer済みの応答を汎用エラーにし、
      // 容量不足の詳細だけをEphemeral follow-upで返す。
      await interaction.editReply({ content: '接続処理中に利用可能なBotがなくなりました。' });
      await interaction.followUp({
        content: CAPACITY_ERROR_MESSAGE,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (result.status === 'failed') {
      await interaction.editReply({ content: result.message ?? 'ボイスチャンネルへの接続に失敗しました。' });
      return;
    }

    if (result.status === 'updated' || result.status === 'already-connected') {
      await interaction.editReply({ content: `読み上げチャンネルを <#${textChannelId}> に変更しました。` });
    } else {
      await interaction.editReply({
        content: `<#${voiceChannel.id}> に接続しました。<#${textChannelId}> のメッセージを読み上げます。`,
      });
    }
  } catch (error) {
    logger.error({ err: error, guildId, voiceChannelId: voiceChannel.id }, 'Failed to join VC');
    if (deferred) {
      await interaction.editReply({
        content: 'ボイスチャンネルへの接続に失敗しました。Bot の権限を確認してください。',
      });
    } else {
      await interaction.reply({
        content: 'ボイスチャンネルへの接続に失敗しました。Bot の権限を確認してください。',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export const joinCommand: CommandDefinition = { data, execute };
