import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { CommandDefinition } from './types.js';
import { createVcSession, getVcSession, updateTextChannel } from '../services/vc-session-manager.js';
import { getGuildSettings } from '../services/guild-settings-service.js';
import { enqueuePreSynthesized } from '../services/speech-queue.js';
import { getPredefinedAudio } from '../services/predefined-audio-cache.js';
import { config } from '../infrastructure/config.js';
import { logger } from '../infrastructure/logger.js';

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
  const guild = interaction.guild!;
  const textChannelId = interaction.channelId;

  // ユーザーが VC に参加しているか確認
  const voiceChannel = member.voice.channel;
  if (!voiceChannel) {
    await interaction.reply({
      content: 'ボイスチャンネルに参加してからコマンドを実行してください。',
      ephemeral: true,
    });
    return;
  }

  // 既存のセッションを確認
  const existingSession = getVcSession(guildId);
  if (existingSession) {
    if (existingSession.voiceChannelId === voiceChannel.id) {
      // 同じ VC に接続中 → 読み上げチャンネルを変更
      await updateTextChannel(guildId, textChannelId);
      await interaction.reply({
        content: `読み上げチャンネルを <#${textChannelId}> に変更しました。`,
      });
      return;
    }
    // 別の VC に接続中 → エラー
    await interaction.reply({
      content: `現在 <#${existingSession.voiceChannelId}> で使用中です。切り替えるには \`/leave\` で退出してから再度 \`/join\` してください。`,
      ephemeral: true,
    });
    return;
  }

  // VC に接続
  try {
    await interaction.deferReply();

    await createVcSession(guildId, voiceChannel.id, textChannelId, guild.voiceAdapterCreator);

    await interaction.editReply({
      content: `<#${voiceChannel.id}> に接続しました。<#${textChannelId}> のメッセージを読み上げます。`,
    });

    // 挨拶の読み上げ
    const settings = await getGuildSettings(guildId);
    if (settings.greetingOnJoin) {
      const speakerId = settings.defaultSpeakerId ?? config.defaultSpeakerId;
      const audio = await getPredefinedAudio('接続しました', speakerId, 1.0, 0.0);
      if (audio) {
        enqueuePreSynthesized(guildId, audio);
      }
    }
  } catch (error) {
    logger.error({ err: error, guildId, voiceChannelId: voiceChannel.id }, 'Failed to join VC');
    await interaction.editReply({
      content: 'ボイスチャンネルへの接続に失敗しました。Bot の権限を確認してください。',
    });
  }
}

export const joinCommand: CommandDefinition = { data, execute };
