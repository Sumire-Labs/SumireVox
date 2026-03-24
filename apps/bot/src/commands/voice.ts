import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import { CommandDefinition } from './types.js';
import { getUserVoiceSetting } from '../services/user-voice-setting-service.js';
import { getSpeakers, getSpeakerStyleName } from '../services/voicevox-speaker-cache.js';
import { buildCustomId } from '@sumirevox/shared';

const data = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('話者・速度・ピッチを設定します')
  .setDMPermission(false);

export function buildVoiceMessage(
  speakerName: string,
  speedScale: number,
  pitchScale: number,
  styles: Array<{ label: string; value: string }>,
  currentPage: number,
  totalPages: number,
  userId: string,
  currentSpeakerId: number | null,
): { components: ContainerBuilder[]; flags: number } {
  const container = new ContainerBuilder().setAccentColor(0x7c3aed);

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## 🎤 音声設定'))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'あなたの音声設定です。PREMIUM サーバーで適用されます。',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**現在の話者:** ${speakerName}\n**速度:** ${speedScale}\n**ピッチ:** ${pitchScale}`,
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 話者を選択'));

  const pageStyles = styles.slice(currentPage * 25, (currentPage + 1) * 25);
  if (pageStyles.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(buildCustomId('voice', `speaker:${currentPage}`, userId))
      .setPlaceholder('話者を選択')
      .addOptions(
        pageStyles.map((s) => ({
          label: s.label,
          value: s.value,
          default: currentSpeakerId !== null && s.value === currentSpeakerId.toString(),
        })),
      );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    );
  }

  if (totalPages > 1) {
    const prevButton = new ButtonBuilder()
      .setCustomId(buildCustomId('voice', `page:${currentPage - 1}`, userId))
      .setLabel('◀ 前')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage === 0);
    const pageIndicator = new ButtonBuilder()
      .setCustomId(buildCustomId('voice', 'page_indicator', userId))
      .setLabel(`${currentPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    const nextButton = new ButtonBuilder()
      .setCustomId(buildCustomId('voice', `page:${currentPage + 1}`, userId))
      .setLabel('次 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages - 1);
    container.addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageIndicator, nextButton),
    );
  }

  container.addSeparatorComponents(
    new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
  );

  const speedButton = new ButtonBuilder()
    .setCustomId(buildCustomId('voice', 'edit_speed', userId))
    .setLabel(`🔊 速度を変更 (現在: ${speedScale})`)
    .setStyle(ButtonStyle.Primary);
  const pitchButton = new ButtonBuilder()
    .setCustomId(buildCustomId('voice', 'edit_pitch', userId))
    .setLabel(`🎵 ピッチを変更 (現在: ${pitchScale})`)
    .setStyle(ButtonStyle.Primary);
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(speedButton, pitchButton),
  );

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.inGuild()) {
    await interaction.reply({
      content: 'このコマンドはサーバー内でのみ使用できます。',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userId = interaction.user.id;
  const setting = await getUserVoiceSetting(userId);

  const speakerName =
    setting.speakerId !== null
      ? (getSpeakerStyleName(setting.speakerId) ?? `ID: ${setting.speakerId}`)
      : '未設定（サーバーデフォルト）';

  const speakers = getSpeakers();
  const styles = speakers.flatMap((s) =>
    s.styles.map((st) => ({
      label: `${s.name}（${st.name}）`,
      value: st.id.toString(),
    })),
  );

  const totalPages = Math.max(1, Math.ceil(styles.length / 25));
  const { components, flags } = buildVoiceMessage(
    speakerName,
    setting.speedScale,
    setting.pitchScale,
    styles,
    0,
    totalPages,
    userId,
    setting.speakerId,
  );

  await interaction.reply({ components, flags });
}

export const voiceCommand: CommandDefinition = { data, execute };
