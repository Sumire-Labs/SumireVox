import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import {
  approveGlobalDictionaryRequest,
  rejectGlobalDictionaryRequest,
} from '../services/dictionary-service.js';
import { config } from '../infrastructure/config.js';
import { AppError } from '../infrastructure/app-error.js';
import { logger } from '../infrastructure/logger.js';

export async function handleNotificationButton(interaction: ButtonInteraction): Promise<void> {
  if (!config.botAdminUserIds.includes(interaction.user.id)) {
    await interaction.reply({
      content: 'この操作は Bot 管理者のみ実行できます。',
      ephemeral: true,
    });
    return;
  }

  const customId = interaction.customId;
  const isApprove = customId.startsWith('dict_notify_approve:');
  const requestId = isApprove
    ? customId.replace('dict_notify_approve:', '')
    : customId.replace('dict_notify_reject:', '');

  try {
    if (isApprove) {
      await approveGlobalDictionaryRequest(requestId);
    } else {
      await rejectGlobalDictionaryRequest(requestId);
    }

    const originalEmbed = interaction.message.embeds[0];
    const updatedEmbed = EmbedBuilder.from(originalEmbed)
      .setColor(isApprove ? 0x22c55e : 0xef4444)
      .setFooter({
        text: `${isApprove ? '承認' : '却下'}済み — by ${interaction.user.tag}`,
      });

    await interaction.update({ embeds: [updatedEmbed], components: [] });
  } catch (error) {
    if (error instanceof AppError) {
      await interaction.reply({ content: error.message, ephemeral: true });
      return;
    }
    logger.error({ err: error }, 'Notification button error');
    await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
  }
}
