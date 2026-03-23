import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction,
} from 'discord.js';
import { parseCustomId, isCustomIdExpired, ParsedCustomId } from '@sumirevox/shared';
import { logger } from '../infrastructure/logger.js';

type ViewInteraction =
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ModalSubmitInteraction
  | RoleSelectMenuInteraction
  | ChannelSelectMenuInteraction;

type ViewHandler = (interaction: ViewInteraction, parsed: ParsedCustomId) => Promise<void>;

const viewHandlers = new Map<string, ViewHandler>();

export function registerViewHandler(command: string, handler: ViewHandler): void {
  viewHandlers.set(command, handler);
}

export async function routeViewInteraction(interaction: ViewInteraction): Promise<void> {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) {
    return;
  }

  if (isCustomIdExpired(parsed)) {
    await interaction
      .reply({
        content: 'この操作は期限切れです。コマンドを再度実行してください。',
        ephemeral: true,
      })
      .catch(() => {});
    return;
  }

  if (parsed.userId !== interaction.user.id) {
    await interaction
      .reply({
        content: 'この操作は実行できません。',
        ephemeral: true,
      })
      .catch(() => {});
    return;
  }

  const handler = viewHandlers.get(parsed.command);
  if (!handler) {
    logger.warn({ command: parsed.command, action: parsed.action }, 'Unknown view handler');
    return;
  }

  try {
    await handler(interaction, parsed);
  } catch (error) {
    logger.error(
      { err: error, command: parsed.command, action: parsed.action, userId: interaction.user.id },
      'View handler error',
    );
    const errorMessage = '操作中にエラーが発生しました。';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true }).catch(() => {});
    }
  }
}
