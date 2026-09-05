import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, MessageFlags } from 'discord.js';
import { CommandDefinition } from './types.js';
import { getVcSession, updateTextChannel } from '../services/vc-session-manager.js';
import { getAvailableBotInstanceIds } from '../services/premium-service.js';
import { logger } from '../infrastructure/logger.js';
import { getRedisClient } from '../infrastructure/redis.js';
import { REDIS_KEYS } from '@sumirevox/shared';
import { delegateBotCommand } from '../services/bot-command-delegation-service.js';

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
      ephemeral: true,
    });
    return;
  }

  const existingSession = getVcSession(guildId);
  if (existingSession && existingSession.voiceChannelId === voiceChannel.id) {
      // 同じ VC に接続中 → 読み上げチャンネルを変更
      await updateTextChannel(guildId, textChannelId);
      await interaction.reply({
        content: `読み上げチャンネルを <#${textChannelId}> に変更しました。`,
      });
      return;
  }
  if (existingSession) {
    await interaction.reply({
      content: `現在 <#${existingSession.voiceChannelId}> で使用中です。切り替えるには \`/leave\` で退出してから再度 \`/join\` してください。`,
      ephemeral: true,
    });
    return;
  }

  try {
    await interaction.deferReply();
    const owningInstanceId = await findOwningInstance(guildId, voiceChannel.id);
    if (owningInstanceId) {
      const result = await delegateBotCommand(owningInstanceId, {
        action: 'join', guildId, voiceChannelId: voiceChannel.id, textChannelId,
      });
      if (!result.success) {
        await interaction.editReply({ content: result.message ?? '読み上げチャンネルの変更に失敗しました。' });
        return;
      }
      await interaction.editReply({ content: `読み上げチャンネルを <#${textChannelId}> に変更しました。` });
      return;
    }
    const candidates = await getAvailableBotInstanceIds(guildId);
    const targetInstanceId = await findFreeInstance(guildId, candidates);
    if (!targetInstanceId) {
      await interaction.editReply({ content: '利用可能なBotがすべて別のVCで使用中です。' });
      return;
    }
    const result = await delegateBotCommand(targetInstanceId, {
      action: 'join', guildId, voiceChannelId: voiceChannel.id, textChannelId,
    });
    if (!result.success) {
      await interaction.editReply({ content: result.message ?? 'ボイスチャンネルへの接続に失敗しました。' });
      return;
    }

    await interaction.editReply({
      content: `<#${voiceChannel.id}> に接続しました。<#${textChannelId}> のメッセージを読み上げます。`,
    });

  } catch (error) {
    logger.error({ err: error, guildId, voiceChannelId: voiceChannel.id }, 'Failed to join VC');
    await interaction.editReply({
      content: 'ボイスチャンネルへの接続に失敗しました。Bot の権限を確認してください。',
    });
  }
}

async function findOwningInstance(guildId: string, voiceChannelId: string): Promise<number | undefined> {
  const value = await getRedisClient().get(REDIS_KEYS.VC_CLAIM(guildId, voiceChannelId));
  const instanceId = value ? Number(value.split(':', 1)[0]) : Number.NaN;
  return Number.isInteger(instanceId) ? instanceId : undefined;
}

async function findFreeInstance(guildId: string, candidates: readonly number[]): Promise<number | undefined> {
  for (const instanceId of candidates) {
    if (!(await getRedisClient().get(REDIS_KEYS.BOT_VC_CLAIM(guildId, instanceId)))) return instanceId;
  }
  return undefined;
}

export const joinCommand: CommandDefinition = { data, execute };
