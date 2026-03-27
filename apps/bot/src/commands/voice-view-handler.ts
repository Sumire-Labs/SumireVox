import {
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  Interaction,
} from 'discord.js';
import { parseCustomId, buildCustomId, LIMITS, ParsedCustomId } from '@sumirevox/shared';
import { getUserVoiceSetting, updateUserVoiceSetting } from '../services/user-voice-setting-service.js';
import { getSpeakers, getSpeakerStyleName } from '../services/voicevox-speaker-cache.js';
import { buildVoiceMessage } from './voice.js';

/**
 * /voice の View インタラクションをハンドリングする
 */
export async function handleVoiceView(
  interaction: Interaction,
  parsed: ParsedCustomId,
): Promise<void> {
  const action = parsed.action;

  if (action.startsWith('speaker:') && interaction.isStringSelectMenu()) {
    await handleSpeakerSelect(interaction, parsed);
    return;
  }

  if (action.startsWith('page:') && interaction.isButton()) {
    await handlePageChange(interaction, parsed);
    return;
  }

  if (action === 'edit_speed' && interaction.isButton()) {
    await showSpeedModal(interaction, parsed);
    return;
  }

  if (action === 'edit_pitch' && interaction.isButton()) {
    await showPitchModal(interaction, parsed);
    return;
  }

  if (action === 'modal_speed' && interaction.isModalSubmit()) {
    await handleSpeedSubmit(interaction, parsed);
    return;
  }

  if (action === 'modal_pitch' && interaction.isModalSubmit()) {
    await handlePitchSubmit(interaction, parsed);
    return;
  }
}

async function handleSpeakerSelect(
  interaction: StringSelectMenuInteraction,
  parsed: ParsedCustomId,
): Promise<void> {
  const speakerId = parseInt(interaction.values[0], 10);
  await updateUserVoiceSetting(parsed.userId, { speakerId });

  const setting = await getUserVoiceSetting(parsed.userId);
  const speakerName = getSpeakerStyleName(speakerId) ?? `ID: ${speakerId}`;
  const speakers = getSpeakers();
  const styles = speakers.flatMap((s) =>
    s.styles.map((st) => ({
      label: `${s.name}（${st.name}）`,
      value: st.id.toString(),
    })),
  );
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(styles.length / pageSize));
  const currentPage = parseInt(parsed.action.split(':')[1], 10) || 0;

  const { components } = buildVoiceMessage(
    speakerName,
    setting.speedScale,
    setting.pitchScale,
    styles,
    currentPage,
    totalPages,
    parsed.userId,
    setting.speakerId,
  );

  await interaction.update({ components });
}

async function handlePageChange(
  interaction: ButtonInteraction,
  parsed: ParsedCustomId,
): Promise<void> {
  const page = parseInt(parsed.action.split(':')[1], 10);
  const userId = parsed.userId;
  const setting = await getUserVoiceSetting(userId);

  const speakers = getSpeakers();
  const styles = speakers.flatMap((s) =>
    s.styles.map((st) => ({
      label: `${s.name}（${st.name}）`,
      value: st.id.toString(),
    })),
  );

  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(styles.length / pageSize));
  const clampedPage = Math.max(0, Math.min(page, totalPages - 1));

  const speakerName =
    setting.speakerId !== null
      ? (getSpeakerStyleName(setting.speakerId) ?? `ID: ${setting.speakerId}`)
      : '未設定（サーバーデフォルト）';

  const { components } = buildVoiceMessage(
    speakerName,
    setting.speedScale,
    setting.pitchScale,
    styles,
    clampedPage,
    totalPages,
    userId,
    setting.speakerId,
  );

  await interaction.update({ components });
}

async function showSpeedModal(
  interaction: ButtonInteraction,
  parsed: ParsedCustomId,
): Promise<void> {
  const setting = await getUserVoiceSetting(parsed.userId);
  const modal = new ModalBuilder()
    .setCustomId(buildCustomId('voice', 'modal_speed', parsed.userId))
    .setTitle('速度の変更');
  const input = new TextInputBuilder()
    .setCustomId('speed_value')
    .setLabel(`速度 (${LIMITS.SPEED_SCALE_MIN}〜${LIMITS.SPEED_SCALE_MAX})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 1.2')
    .setValue(setting.speedScale.toString())
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function showPitchModal(
  interaction: ButtonInteraction,
  parsed: ParsedCustomId,
): Promise<void> {
  const setting = await getUserVoiceSetting(parsed.userId);
  const modal = new ModalBuilder()
    .setCustomId(buildCustomId('voice', 'modal_pitch', parsed.userId))
    .setTitle('ピッチの変更');
  const input = new TextInputBuilder()
    .setCustomId('pitch_value')
    .setLabel(`ピッチ (${LIMITS.PITCH_SCALE_MIN}〜${LIMITS.PITCH_SCALE_MAX})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('例: 0.05')
    .setValue(setting.pitchScale.toString())
    .setRequired(true);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function handleSpeedSubmit(
  interaction: ModalSubmitInteraction,
  parsed: ParsedCustomId,
): Promise<void> {
  const value = parseFloat(interaction.fields.getTextInputValue('speed_value'));
  if (isNaN(value) || value < LIMITS.SPEED_SCALE_MIN || value > LIMITS.SPEED_SCALE_MAX) {
    await interaction.reply({
      content: `速度は ${LIMITS.SPEED_SCALE_MIN} 〜 ${LIMITS.SPEED_SCALE_MAX} の範囲で入力してください。`,
      ephemeral: true,
    });
    return;
  }
  await updateUserVoiceSetting(parsed.userId, { speedScale: value });

  const setting = await getUserVoiceSetting(parsed.userId);
  const speakerName =
    setting.speakerId !== null
      ? (getSpeakerStyleName(setting.speakerId) ?? `ID: ${setting.speakerId}`)
      : '未設定（サーバーデフォルト）';
  const speakers = getSpeakers();
  const styles = speakers.flatMap((s) =>
    s.styles.map((st) => ({ label: `${s.name}（${st.name}）`, value: st.id.toString() })),
  );
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(styles.length / pageSize));
  const { components } = buildVoiceMessage(
    speakerName,
    setting.speedScale,
    setting.pitchScale,
    styles,
    0,
    totalPages,
    parsed.userId,
    setting.speakerId,
  );

  await interaction.reply({ content: `速度を **${value}** に変更しました。`, ephemeral: true });
  if (interaction.message) {
    await interaction.message.edit({ components });
  }
}

async function handlePitchSubmit(
  interaction: ModalSubmitInteraction,
  parsed: ParsedCustomId,
): Promise<void> {
  const value = parseFloat(interaction.fields.getTextInputValue('pitch_value'));
  if (isNaN(value) || value < LIMITS.PITCH_SCALE_MIN || value > LIMITS.PITCH_SCALE_MAX) {
    await interaction.reply({
      content: `ピッチは ${LIMITS.PITCH_SCALE_MIN} 〜 ${LIMITS.PITCH_SCALE_MAX} の範囲で入力してください。`,
      ephemeral: true,
    });
    return;
  }
  await updateUserVoiceSetting(parsed.userId, { pitchScale: value });

  const setting = await getUserVoiceSetting(parsed.userId);
  const speakerName =
    setting.speakerId !== null
      ? (getSpeakerStyleName(setting.speakerId) ?? `ID: ${setting.speakerId}`)
      : '未設定（サーバーデフォルト）';
  const speakers = getSpeakers();
  const styles = speakers.flatMap((s) =>
    s.styles.map((st) => ({ label: `${s.name}（${st.name}）`, value: st.id.toString() })),
  );
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(styles.length / pageSize));
  const { components } = buildVoiceMessage(
    speakerName,
    setting.speedScale,
    setting.pitchScale,
    styles,
    0,
    totalPages,
    parsed.userId,
    setting.speakerId,
  );

  await interaction.reply({ content: `ピッチを **${value}** に変更しました。`, ephemeral: true });
  if (interaction.message) {
    await interaction.message.edit({ components });
  }
}
