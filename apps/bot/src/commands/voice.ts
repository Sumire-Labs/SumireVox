import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { CommandDefinition } from './types.js';
import { getUserVoiceSetting } from '../services/user-voice-setting-service.js';
import { getSpeakers, getSpeakerStyleName } from '../services/voicevox-speaker-cache.js';
import { buildCustomId } from '@sumirevox/shared';

const data = new SlashCommandBuilder()
  .setName('voice')
  .setDescription('話者・速度・ピッチを設定します');

async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const userId = interaction.user.id;
  const setting = await getUserVoiceSetting(userId);

  const speakerName =
    setting.speakerId !== null
      ? (getSpeakerStyleName(setting.speakerId) ?? `ID: ${setting.speakerId}`)
      : '未設定（サーバーデフォルト）';

  const embed = new EmbedBuilder()
    .setTitle('音声設定')
    .setDescription('あなたの音声設定です。PREMIUM サーバーで適用されます。')
    .addFields(
      { name: '話者', value: speakerName, inline: true },
      { name: '速度', value: `${setting.speedScale}`, inline: true },
      { name: 'ピッチ', value: `${setting.pitchScale}`, inline: true },
    )
    .setColor(0x7c3aed);

  const speakers = getSpeakers();
  const styles = speakers.flatMap((s) =>
    s.styles.map((st) => ({
      label: `${s.name}（${st.name}）`,
      value: st.id.toString(),
    })),
  );

  const pageSize = 25;
  const totalPages = Math.ceil(styles.length / pageSize);
  const currentPage = 0;
  const pageStyles = styles.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];

  if (pageStyles.length > 0) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(buildCustomId('voice', `speaker:${currentPage}`, userId))
      .setPlaceholder('話者を選択')
      .addOptions(
        pageStyles.map((s) => ({
          label: s.label,
          value: s.value,
          default: setting.speakerId !== null && s.value === setting.speakerId.toString(),
        })),
      );
    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    );
  }

  if (totalPages > 1) {
    const prevButton = new ButtonBuilder()
      .setCustomId(buildCustomId('voice', `page:${currentPage - 1}`, userId))
      .setLabel('◀ 前')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    const pageIndicator = new ButtonBuilder()
      .setCustomId(buildCustomId('voice', 'page_indicator', userId))
      .setLabel(`${currentPage + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true);
    const nextButton = new ButtonBuilder()
      .setCustomId(buildCustomId('voice', `page:${currentPage + 1}`, userId))
      .setLabel('次 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(false);
    components.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageIndicator, nextButton),
    );
  }

  const speedButton = new ButtonBuilder()
    .setCustomId(buildCustomId('voice', 'edit_speed', userId))
    .setLabel(`速度を変更 (現在: ${setting.speedScale})`)
    .setStyle(ButtonStyle.Primary);
  const pitchButton = new ButtonBuilder()
    .setCustomId(buildCustomId('voice', 'edit_pitch', userId))
    .setLabel(`ピッチを変更 (現在: ${setting.pitchScale})`)
    .setStyle(ButtonStyle.Primary);
  components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(speedButton, pitchButton));

  await interaction.reply({ embeds: [embed], components });
}

export const voiceCommand: CommandDefinition = { data, execute };
