import {
  Interaction,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  GuildMember,
  InteractionReplyOptions,
  InteractionUpdateOptions,
  TextChannel,
} from 'discord.js';
import { buildCustomId, parseCustomId, LIMITS } from '@sumirevox/shared';
import {
  getServerDictionaryEntries,
  addServerDictionaryEntry,
  deleteServerDictionaryEntry,
  getGlobalDictionaryEntries,
  createGlobalDictionaryRequest,
  approveGlobalDictionaryRequest,
  rejectGlobalDictionaryRequest,
  getPendingRequests,
} from '../services/dictionary-service.js';
import { hasAdminPermission, hasDictionaryAddPermission } from '../services/permission-service.js';
import { isGuildPremium } from '../services/premium-service.js';
import { config } from '../infrastructure/config.js';
import { getClient } from '../infrastructure/discord-client.js';
import { AppError } from '../infrastructure/app-error.js';
import { logger } from '../infrastructure/logger.js';

type ParsedId = NonNullable<ReturnType<typeof parseCustomId>>;
type Tab = 'server' | 'global' | 'request';

export async function buildDictionaryMessage(
  guildId: string,
  userId: string,
  tab: Tab,
  page: number,
): Promise<InteractionReplyOptions & InteractionUpdateOptions> {
  const tabSelect = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId('dict', 'tab', userId))
    .setPlaceholder('タブを選択')
    .addOptions(
      { label: 'サーバー辞書', value: 'server', default: tab === 'server' },
      { label: 'グローバル辞書', value: 'global', default: tab === 'global' },
      { label: 'グローバル辞書申請', value: 'request', default: tab === 'request' },
    );

  const tabRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(tabSelect);
  const { embed, components } = await buildTabContent(guildId, userId, tab, page);

  return {
    embeds: [embed],
    components: [tabRow, ...components],
  };
}

async function buildTabContent(
  guildId: string,
  userId: string,
  tab: Tab,
  page: number,
): Promise<{ embed: EmbedBuilder; components: ActionRowBuilder<never>[] }> {
  switch (tab) {
    case 'server':
      return buildServerDictionaryTab(guildId, userId, page);
    case 'global':
      return buildGlobalDictionaryTab(userId, page);
    case 'request':
      return buildRequestTab(guildId, userId, page);
  }
}

// ---- サーバー辞書タブ ----

async function buildServerDictionaryTab(guildId: string, userId: string, page: number) {
  const { entries, total } = await getServerDictionaryEntries(guildId, page);
  const totalPages = Math.max(1, Math.ceil(total / LIMITS.DICTIONARY_PAGE_SIZE));

  const embed = new EmbedBuilder()
    .setTitle('📚 サーバー辞書')
    .setDescription(
      entries.length > 0
        ? entries.map((e) => `**${e.word}** → ${e.reading}`).join('\n')
        : '辞書エントリはありません。',
    )
    .setColor(0x7c3aed);

  if (total > 0) {
    const start = (page - 1) * LIMITS.DICTIONARY_PAGE_SIZE + 1;
    const end = Math.min(page * LIMITS.DICTIONARY_PAGE_SIZE, total);
    embed.setFooter({ text: `${total}件中 ${start}〜${end}件 | ページ ${page}/${totalPages}` });
  } else {
    embed.setFooter({ text: '0件' });
  }

  const components: ActionRowBuilder<never>[] = [];

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `server_page:${page - 1}`, userId))
      .setLabel('◀ 前')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `server_page:${page + 1}`, userId))
      .setLabel('次 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', 'server_add', userId))
      .setLabel('追加')
      .setStyle(ButtonStyle.Primary),
  );
  components.push(navRow as ActionRowBuilder<never>);

  if (entries.length > 0) {
    const deleteSelect = new StringSelectMenuBuilder()
      .setCustomId(buildCustomId('dict', 'server_delete_select', userId))
      .setPlaceholder('削除するエントリを選択')
      .addOptions(entries.map((e) => ({ label: `${e.word} → ${e.reading}`, value: e.word })));
    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        deleteSelect,
      ) as ActionRowBuilder<never>,
    );
  }

  return { embed, components };
}

// ---- グローバル辞書タブ ----

async function buildGlobalDictionaryTab(userId: string, page: number) {
  const { entries, total } = await getGlobalDictionaryEntries(page);
  const totalPages = Math.max(1, Math.ceil(total / LIMITS.DICTIONARY_PAGE_SIZE));

  const embed = new EmbedBuilder()
    .setTitle('🌐 グローバル辞書')
    .setDescription(
      entries.length > 0
        ? entries.map((e) => `**${e.word}** → ${e.reading}`).join('\n')
        : 'グローバル辞書エントリはありません。',
    )
    .setColor(0x7c3aed);

  if (total > 0) {
    const start = (page - 1) * LIMITS.DICTIONARY_PAGE_SIZE + 1;
    const end = Math.min(page * LIMITS.DICTIONARY_PAGE_SIZE, total);
    embed.setFooter({ text: `${total}件中 ${start}〜${end}件 | ページ ${page}/${totalPages}` });
  } else {
    embed.setFooter({ text: '0件' });
  }

  const components: ActionRowBuilder<never>[] = [];

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `global_page:${page - 1}`, userId))
      .setLabel('◀ 前')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `global_page:${page + 1}`, userId))
      .setLabel('次 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', 'global_request', userId))
      .setLabel('申請')
      .setStyle(ButtonStyle.Primary),
  );
  components.push(navRow as ActionRowBuilder<never>);

  return { embed, components };
}

// ---- グローバル辞書申請タブ ----

async function buildRequestTab(guildId: string, userId: string, page: number) {
  const isBotAdmin = config.botAdminUserIds.includes(userId);
  const { requests, total } = await getPendingRequests(page);
  const totalPages = Math.max(1, Math.ceil(total / LIMITS.DICTIONARY_PAGE_SIZE));

  const embed = new EmbedBuilder()
    .setTitle('📝 グローバル辞書申請')
    .setDescription(
      requests.length > 0
        ? requests
            .map(
              (r) =>
                `**${r.word}** → ${r.reading}${r.reason ? ` (理由: ${r.reason})` : ''} — <@${r.requestedBy}>`,
            )
            .join('\n')
        : '未処理の申請はありません。',
    )
    .setColor(0x7c3aed);

  if (total > 0) {
    const start = (page - 1) * LIMITS.DICTIONARY_PAGE_SIZE + 1;
    const end = Math.min(page * LIMITS.DICTIONARY_PAGE_SIZE, total);
    embed.setFooter({ text: `${total}件中 ${start}〜${end}件 | ページ ${page}/${totalPages}` });
  } else {
    embed.setFooter({ text: '0件' });
  }

  const components: ActionRowBuilder<never>[] = [];

  const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `request_page:${page - 1}`, userId))
      .setLabel('◀ 前')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `request_page:${page + 1}`, userId))
      .setLabel('次 ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
  );
  components.push(navRow as ActionRowBuilder<never>);

  if (isBotAdmin && requests.length > 0) {
    const approveSelect = new StringSelectMenuBuilder()
      .setCustomId(buildCustomId('dict', 'request_action_select', userId))
      .setPlaceholder('処理する申請を選択')
      .addOptions(requests.map((r) => ({ label: `${r.word} → ${r.reading}`, value: r.id })));
    components.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        approveSelect,
      ) as ActionRowBuilder<never>,
    );
  }

  return { embed, components };
}

// ========================================
// View ハンドラ
// ========================================

export async function handleDictionaryView(
  interaction: Interaction,
  parsed: ParsedId,
): Promise<void> {
  const action = parsed.action;
  const guildId = interaction.guildId!;

  if (action === 'tab' && interaction.isStringSelectMenu()) {
    const tab = interaction.values[0] as Tab;
    const message = await buildDictionaryMessage(guildId, parsed.userId, tab, 1);
    await interaction.update(message);
    return;
  }

  if (action.startsWith('server_page:') && interaction.isButton()) {
    const page = Math.max(1, parseInt(action.split(':')[1], 10));
    const message = await buildDictionaryMessage(guildId, parsed.userId, 'server', page);
    await interaction.update(message);
    return;
  }

  if (action.startsWith('global_page:') && interaction.isButton()) {
    const page = Math.max(1, parseInt(action.split(':')[1], 10));
    const message = await buildDictionaryMessage(guildId, parsed.userId, 'global', page);
    await interaction.update(message);
    return;
  }

  if (action.startsWith('request_page:') && interaction.isButton()) {
    const page = Math.max(1, parseInt(action.split(':')[1], 10));
    const message = await buildDictionaryMessage(guildId, parsed.userId, 'request', page);
    await interaction.update(message);
    return;
  }

  if (action === 'server_add' && interaction.isButton()) {
    await showServerAddModal(interaction, parsed);
    return;
  }

  if (action === 'modal_server_add' && interaction.isModalSubmit()) {
    await handleServerAddSubmit(interaction, parsed);
    return;
  }

  if (action === 'server_delete_select' && interaction.isStringSelectMenu()) {
    await handleServerDeleteSelect(interaction, parsed);
    return;
  }

  if (action.startsWith('server_delete_confirm:') && interaction.isButton()) {
    await handleServerDeleteConfirm(interaction, parsed);
    return;
  }

  if (action === 'server_delete_cancel' && interaction.isButton()) {
    const message = await buildDictionaryMessage(guildId, parsed.userId, 'server', 1);
    await interaction.update(message);
    return;
  }

  if (action === 'global_request' && interaction.isButton()) {
    await showGlobalRequestModal(interaction, parsed);
    return;
  }

  if (action === 'modal_global_request' && interaction.isModalSubmit()) {
    await handleGlobalRequestSubmit(interaction, parsed);
    return;
  }

  if (action === 'request_action_select' && interaction.isStringSelectMenu()) {
    await handleRequestActionSelect(interaction, parsed);
    return;
  }

  if (action.startsWith('request_approve:') && interaction.isButton()) {
    await handleRequestApprove(interaction, parsed);
    return;
  }

  if (action.startsWith('request_reject:') && interaction.isButton()) {
    await handleRequestReject(interaction, parsed);
    return;
  }
}

// ---- サーバー辞書追加 ----

async function showServerAddModal(
  interaction: ButtonInteraction,
  parsed: ParsedId,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;
  const canAdd = await hasDictionaryAddPermission(member, guildId);
  if (!canAdd) {
    await interaction.reply({ content: 'サーバー辞書の追加権限がありません。', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(buildCustomId('dict', 'modal_server_add', parsed.userId))
    .setTitle('サーバー辞書に追加');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('word')
        .setLabel(`単語（最大${LIMITS.DICTIONARY_WORD_MAX_LENGTH}文字）`)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(LIMITS.DICTIONARY_WORD_MAX_LENGTH)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reading')
        .setLabel(`読み（ひらがな・カタカナ、最大${LIMITS.DICTIONARY_READING_MAX_LENGTH}文字）`)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(LIMITS.DICTIONARY_READING_MAX_LENGTH)
        .setRequired(true),
    ),
  );

  await interaction.showModal(modal);
}

async function handleServerAddSubmit(
  interaction: ModalSubmitInteraction,
  parsed: ParsedId,
): Promise<void> {
  const guildId = interaction.guildId!;
  const word = interaction.fields.getTextInputValue('word');
  const reading = interaction.fields.getTextInputValue('reading');
  const isPremium = await isGuildPremium(guildId);

  try {
    await addServerDictionaryEntry(guildId, word, reading, parsed.userId, isPremium);
    await interaction.reply({
      content: `辞書に追加しました: **${word.trim()}** → ${reading.trim()}`,
      ephemeral: true,
    });
  } catch (error) {
    if (error instanceof AppError) {
      await interaction.reply({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

// ---- サーバー辞書削除 ----

async function handleServerDeleteSelect(
  interaction: StringSelectMenuInteraction,
  parsed: ParsedId,
): Promise<void> {
  const member = interaction.member as GuildMember;
  const guildId = interaction.guildId!;
  const isAdmin = await hasAdminPermission(member, guildId);
  if (!isAdmin) {
    await interaction.reply({
      content: '辞書エントリの削除にはサーバーの管理権限が必要です。',
      ephemeral: true,
    });
    return;
  }

  const word = interaction.values[0];
  const embed = new EmbedBuilder()
    .setTitle('削除の確認')
    .setDescription(`**${word}** を辞書から削除しますか？`)
    .setColor(0xef4444);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `server_delete_confirm:${word}`, parsed.userId))
      .setLabel('削除する')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', 'server_delete_cancel', parsed.userId))
      .setLabel('キャンセル')
      .setStyle(ButtonStyle.Secondary),
  );

  await interaction.update({ embeds: [embed], components: [row] });
}

async function handleServerDeleteConfirm(
  interaction: ButtonInteraction,
  parsed: ParsedId,
): Promise<void> {
  const guildId = interaction.guildId!;
  const word = parsed.action.replace('server_delete_confirm:', '');

  try {
    await deleteServerDictionaryEntry(guildId, word);
  } catch (error) {
    logger.error({ err: error, guildId, word }, 'Failed to delete dictionary entry');
  }

  const message = await buildDictionaryMessage(guildId, parsed.userId, 'server', 1);
  await interaction.update(message);
}

// ---- グローバル辞書申請 ----

async function showGlobalRequestModal(
  interaction: ButtonInteraction,
  parsed: ParsedId,
): Promise<void> {
  const modal = new ModalBuilder()
    .setCustomId(buildCustomId('dict', 'modal_global_request', parsed.userId))
    .setTitle('グローバル辞書に申請');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('word')
        .setLabel(`単語（最大${LIMITS.DICTIONARY_WORD_MAX_LENGTH}文字）`)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(LIMITS.DICTIONARY_WORD_MAX_LENGTH)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reading')
        .setLabel(`読み（ひらがな・カタカナ、最大${LIMITS.DICTIONARY_READING_MAX_LENGTH}文字）`)
        .setStyle(TextInputStyle.Short)
        .setMaxLength(LIMITS.DICTIONARY_READING_MAX_LENGTH)
        .setRequired(true),
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('理由（任意）')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(false),
    ),
  );

  await interaction.showModal(modal);
}

async function handleGlobalRequestSubmit(
  interaction: ModalSubmitInteraction,
  parsed: ParsedId,
): Promise<void> {
  const guildId = interaction.guildId!;
  const word = interaction.fields.getTextInputValue('word');
  const reading = interaction.fields.getTextInputValue('reading');
  const reason = interaction.fields.getTextInputValue('reason') || null;

  try {
    const request = await createGlobalDictionaryRequest(
      word,
      reading,
      reason,
      parsed.userId,
      guildId,
    );
    await interaction.reply({
      content: `グローバル辞書に申請しました: **${word.trim()}** → ${reading.trim()}`,
      ephemeral: true,
    });
    await sendRequestNotification(request.id, word.trim(), reading.trim(), reason, parsed.userId);
  } catch (error) {
    if (error instanceof AppError) {
      await interaction.reply({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

async function sendRequestNotification(
  requestId: string,
  word: string,
  reading: string,
  reason: string | null,
  requestedBy: string,
): Promise<void> {
  try {
    const client = getClient();
    const channel = await client.channels.fetch(config.globalDictNotificationChannelId);
    if (!channel || !channel.isTextBased()) {
      logger.warn('Global dictionary notification channel not found or not text-based');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('グローバル辞書申請')
      .addFields(
        { name: '単語', value: word, inline: true },
        { name: '読み', value: reading, inline: true },
        { name: '申請者', value: `<@${requestedBy}>`, inline: true },
      )
      .setColor(0xf59e0b)
      .setTimestamp();

    if (reason) {
      embed.addFields({ name: '理由', value: reason });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`dict_notify_approve:${requestId}`)
        .setLabel('承認')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`dict_notify_reject:${requestId}`)
        .setLabel('却下')
        .setStyle(ButtonStyle.Danger),
    );

    await (channel as TextChannel).send({ embeds: [embed], components: [row] });
  } catch (error) {
    logger.error({ err: error }, 'Failed to send request notification');
  }
}

// ---- 申請の承認/却下（/dictionary コマンド内から） ----

async function handleRequestActionSelect(
  interaction: StringSelectMenuInteraction,
  parsed: ParsedId,
): Promise<void> {
  if (!config.botAdminUserIds.includes(parsed.userId)) {
    await interaction.reply({
      content: 'この操作は Bot 管理者のみ実行できます。',
      ephemeral: true,
    });
    return;
  }

  const requestId = interaction.values[0];
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `request_approve:${requestId}`, parsed.userId))
      .setLabel('承認')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(buildCustomId('dict', `request_reject:${requestId}`, parsed.userId))
      .setLabel('却下')
      .setStyle(ButtonStyle.Danger),
  );

  await interaction.reply({ content: '操作を選択してください。', components: [row], ephemeral: true });
}

async function handleRequestApprove(
  interaction: ButtonInteraction,
  parsed: ParsedId,
): Promise<void> {
  if (!config.botAdminUserIds.includes(parsed.userId)) {
    await interaction.reply({ content: 'Bot 管理者のみ実行できます。', ephemeral: true });
    return;
  }

  const requestId = parsed.action.replace('request_approve:', '');
  try {
    await approveGlobalDictionaryRequest(requestId);
    await interaction.reply({ content: '申請を承認しました。', ephemeral: true });
  } catch (error) {
    if (error instanceof AppError) {
      await interaction.reply({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}

async function handleRequestReject(
  interaction: ButtonInteraction,
  parsed: ParsedId,
): Promise<void> {
  if (!config.botAdminUserIds.includes(parsed.userId)) {
    await interaction.reply({ content: 'Bot 管理者のみ実行できます。', ephemeral: true });
    return;
  }

  const requestId = parsed.action.replace('request_reject:', '');
  try {
    await rejectGlobalDictionaryRequest(requestId);
    await interaction.reply({ content: '申請を却下しました。', ephemeral: true });
  } catch (error) {
    if (error instanceof AppError) {
      await interaction.reply({ content: error.message, ephemeral: true });
      return;
    }
    throw error;
  }
}
