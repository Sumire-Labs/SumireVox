import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { CommandDefinition } from './types.js';

const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('コマンド一覧と使い方を表示します');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('SumireVox — コマンド一覧')
    .setDescription('Discord のテキストチャンネルのメッセージをボイスチャンネルで読み上げる Bot です。')
    .addFields(
      {
        name: '/join',
        value: 'ボイスチャンネルに参加し、コマンドを実行したテキストチャンネルを読み上げ対象にします。',
      },
      {
        name: '/leave',
        value: 'ボイスチャンネルから退出します。',
      },
      {
        name: '/voice',
        value: '音声設定（話者・速度・ピッチ）を変更します。PREMIUM サーバーで適用されます。',
      },
      {
        name: '/settings',
        value: 'サーバー設定を管理します。管理者権限が必要です。',
      },
      {
        name: '/dictionary',
        value: '辞書を管理します。サーバー辞書の追加・削除、グローバル辞書の閲覧・申請ができます。',
      },
      {
        name: '/help',
        value: 'このヘルプを表示します。',
      },
    )
    .setColor(0x7c3aed)
    .setFooter({ text: '詳しくは https://sumirevox.com をご覧ください。' });

  await interaction.reply({ embeds: [embed] });
}

export const helpCommand: CommandDefinition = { data, execute };
