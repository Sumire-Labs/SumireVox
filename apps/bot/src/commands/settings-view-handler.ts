import {
  Interaction,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
  ChannelSelectMenuBuilder,
  RoleSelectMenuBuilder,
  ButtonInteraction,
  ModalSubmitInteraction,
  RoleSelectMenuInteraction,
  ChannelSelectMenuInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import { GuildSettings, buildCustomId, parseCustomId, LIMITS } from '@sumirevox/shared';
import { getGuildSettings } from '../services/guild-settings-service.js';
import { updateGuildSettings } from '../services/guild-settings-update-service.js';
import { getSpeakers, getSpeakerStyleName } from '../services/voicevox-speaker-cache.js';
import { isGuildPremium } from '../services/premium-service.js';

type ParsedId = NonNullable<ReturnType<typeof parseCustomId>>;

const CATEGORIES = [
  { value: 'reading', label: '読み上げ設定', emoji: '📖' },
  { value: 'notification', label: '通知設定', emoji: '🔔' },
  { value: 'filter', label: 'フィルタ設定', emoji: '🔧' },
  { value: 'connection', label: '接続設定', emoji: '🔗' },
  { value: 'permission', label: '権限設定', emoji: '🔒' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];

export function buildSettingsMessage(
  settings: GuildSettings,
  category: Category,
  userId: string,
): { components: ContainerBuilder[] } {
  const mainContainer = new ContainerBuilder().setAccentColor(0x7c3aed);

  const categorySelect = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId('settings', 'category', userId))
    .setPlaceholder('カテゴリを選択')
    .addOptions(
      CATEGORIES.map((c) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(c.label)
          .setValue(c.value)
          .setEmoji(c.emoji)
          .setDefault(c.value === category),
      ),
    );

  mainContainer
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('## ⚙️ サーバー設定'))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'カテゴリを選択して設定を変更してください。',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect),
    );

  const categoryContainer = buildCategoryContainer(settings, category, userId);

  return { components: [mainContainer, categoryContainer] };
}

function buildCategoryContainer(
  settings: GuildSettings,
  category: Category,
  userId: string,
): ContainerBuilder {
  switch (category) {
    case 'reading':
      return buildReadingCategory(settings, userId);
    case 'notification':
      return buildNotificationCategory(settings, userId);
    case 'filter':
      return buildFilterCategory(settings, userId);
    case 'connection':
      return buildConnectionCategory(settings, userId);
    case 'permission':
      return buildPermissionCategory(settings, userId);
  }
}

function buildReadingCategory(settings: GuildSettings, userId: string): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0x7c3aed);

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 📖 読み上げ設定'))
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**読み上げ最大文字数:** ${settings.maxReadLength}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'edit_max_length', userId))
            .setLabel('変更')
            .setStyle(ButtonStyle.Primary),
        ),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**名前の読み上げ:** ${settings.readUsername ? 'ON' : 'OFF'}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'toggle_read_username', userId))
            .setLabel(settings.readUsername ? '✓ ON' : 'OFF')
            .setStyle(settings.readUsername ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**さん付け:** ${settings.addSanSuffix ? 'ON' : 'OFF'}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'toggle_san_suffix', userId))
            .setLabel(settings.addSanSuffix ? '✓ ON' : 'OFF')
            .setStyle(settings.addSanSuffix ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**ローマ字読み:** ${settings.romajiReading ? 'ON' : 'OFF'}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'toggle_romaji', userId))
            .setLabel(settings.romajiReading ? '✓ ON' : 'OFF')
            .setStyle(settings.romajiReading ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
    );

  return container;
}

function buildNotificationCategory(settings: GuildSettings, userId: string): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0x7c3aed);

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🔔 通知設定'))
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**入退室通知:** ${settings.joinLeaveNotification ? 'ON' : 'OFF'}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'toggle_join_leave', userId))
            .setLabel(settings.joinLeaveNotification ? '✓ ON' : 'OFF')
            .setStyle(
              settings.joinLeaveNotification ? ButtonStyle.Success : ButtonStyle.Secondary,
            ),
        ),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**Bot 入室挨拶:** ${settings.greetingOnJoin ? 'ON' : 'OFF'}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'toggle_greeting', userId))
            .setLabel(settings.greetingOnJoin ? '✓ ON' : 'OFF')
            .setStyle(settings.greetingOnJoin ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
    );

  return container;
}

function buildFilterCategory(settings: GuildSettings, userId: string): ContainerBuilder {
  const emojiLabel = settings.customEmojiHandling === 'read_name' ? '名前を読み上げ' : '除去';
  const targetLabel = {
    text_only: 'テキストのみ',
    text_and_sticker: 'テキスト+スタンプ',
    text_sticker_and_attachment: 'テキスト+スタンプ+添付',
  }[settings.readTargetType];

  const emojiSelect = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId('settings', 'emoji_handling', userId))
    .setPlaceholder('カスタム絵文字の扱い')
    .addOptions(
      { label: '名前を読み上げ', value: 'read_name', default: settings.customEmojiHandling === 'read_name' },
      { label: '除去', value: 'remove', default: settings.customEmojiHandling === 'remove' },
    );

  const targetSelect = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId('settings', 'read_target', userId))
    .setPlaceholder('読み上げ対象')
    .addOptions(
      { label: 'テキストのみ', value: 'text_only', default: settings.readTargetType === 'text_only' },
      {
        label: 'テキスト+スタンプ',
        value: 'text_and_sticker',
        default: settings.readTargetType === 'text_and_sticker',
      },
      {
        label: 'テキスト+スタンプ+添付',
        value: 'text_sticker_and_attachment',
        default: settings.readTargetType === 'text_sticker_and_attachment',
      },
    );

  const container = new ContainerBuilder().setAccentColor(0x7c3aed);

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🔧 フィルタ設定'))
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**カスタム絵文字:** ${emojiLabel}`),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(emojiSelect),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**読み上げ対象:** ${targetLabel}`),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(targetSelect),
    );

  return container;
}

function buildConnectionCategory(settings: GuildSettings, userId: string): ContainerBuilder {
  const speakerName =
    settings.defaultSpeakerId !== null
      ? (getSpeakerStyleName(settings.defaultSpeakerId) ?? `ID: ${settings.defaultSpeakerId}`)
      : '未設定';
  const defaultChannelText = settings.defaultTextChannelId
    ? `<#${settings.defaultTextChannelId}>`
    : '未設定';

  const channelSelect = new ChannelSelectMenuBuilder()
    .setCustomId(buildCustomId('settings', 'default_channel', userId))
    .setPlaceholder('デフォルト読み上げチャンネルを選択')
    .setChannelTypes(ChannelType.GuildText);

  const speakers = getSpeakers();
  const speakerOptions = speakers
    .flatMap((s) =>
      s.styles.map((st) => ({
        label: `${s.name}（${st.name}）`,
        value: st.id.toString(),
      })),
    )
    .slice(0, 25);

  const speakerSelect = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId('settings', 'default_speaker', userId))
    .setPlaceholder('デフォルト話者を選択')
    .addOptions(
      speakerOptions.map((s) => ({
        label: s.label,
        value: s.value,
        default:
          settings.defaultSpeakerId !== null && s.value === settings.defaultSpeakerId.toString(),
      })),
    );

  const container = new ContainerBuilder().setAccentColor(0x7c3aed);

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🔗 接続設定'))
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '> 💡 **自動接続はダッシュボードの Bot 管理から設定してください。**',
      ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**デフォルト読み上げチャンネル:** ${defaultChannelText}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(channelSelect),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**デフォルト話者:** ${speakerName}`),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(speakerSelect),
    );

  return container;
}

function buildPermissionCategory(settings: GuildSettings, userId: string): ContainerBuilder {
  const adminRoleText = settings.adminRoleId ? `<@&${settings.adminRoleId}>` : '未設定';
  const dictPermText = settings.dictionaryPermission === 'everyone' ? '全ユーザー' : '管理者のみ';

  const roleSelect = new RoleSelectMenuBuilder()
    .setCustomId(buildCustomId('settings', 'admin_role', userId))
    .setPlaceholder('管理ロールを選択');

  const dictPermSelect = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId('settings', 'dict_permission', userId))
    .setPlaceholder('辞書追加権限')
    .addOptions(
      {
        label: '全ユーザー',
        value: 'everyone',
        default: settings.dictionaryPermission === 'everyone',
      },
      {
        label: '管理者 or 指定ロールのみ',
        value: 'admin_only',
        default: settings.dictionaryPermission === 'admin_only',
      },
    );

  const container = new ContainerBuilder().setAccentColor(0x7c3aed);

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🔒 権限設定'))
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**管理ロール:** ${adminRoleText}`),
    )
    .addActionRowComponents(
      new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleSelect),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**辞書追加権限:** ${dictPermText}`),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(dictPermSelect),
    );

  return container;
}

// ========================================
// View ハンドラ
// ========================================

export async function handleSettingsView(interaction: Interaction, parsed: ParsedId): Promise<void> {
  const action = parsed.action;
  const guildId = interaction.guildId!;

  if (action === 'category' && interaction.isStringSelectMenu()) {
    const category = interaction.values[0] as Category;
    const settings = await getGuildSettings(guildId);
    const { components } = buildSettingsMessage(settings, category, parsed.userId);
    await interaction.update({ components });
    return;
  }

  if (action.startsWith('toggle_') && interaction.isButton()) {
    await handleToggle(interaction, parsed, action);
    return;
  }

  if (action === 'edit_max_length' && interaction.isButton()) {
    await showMaxLengthModal(interaction, parsed);
    return;
  }

  if (action === 'modal_max_length' && interaction.isModalSubmit()) {
    await handleMaxLengthSubmit(interaction, parsed);
    return;
  }

  if (action === 'emoji_handling' && interaction.isStringSelectMenu()) {
    await updateAndRefresh(interaction, guildId, parsed.userId, {
      customEmojiHandling: interaction.values[0] as GuildSettings['customEmojiHandling'],
    }, 'filter');
    return;
  }

  if (action === 'read_target' && interaction.isStringSelectMenu()) {
    await updateAndRefresh(interaction, guildId, parsed.userId, {
      readTargetType: interaction.values[0] as GuildSettings['readTargetType'],
    }, 'filter');
    return;
  }

  if (action === 'default_channel' && interaction.isChannelSelectMenu()) {
    await updateAndRefresh(interaction, guildId, parsed.userId, {
      defaultTextChannelId: interaction.values[0],
    }, 'connection');
    return;
  }

  if (action === 'default_speaker' && interaction.isStringSelectMenu()) {
    await updateAndRefresh(interaction, guildId, parsed.userId, {
      defaultSpeakerId: parseInt(interaction.values[0], 10),
    }, 'connection');
    return;
  }

  if (action === 'admin_role' && interaction.isRoleSelectMenu()) {
    await updateAndRefresh(interaction, guildId, parsed.userId, {
      adminRoleId: interaction.values[0],
    }, 'permission');
    return;
  }

  if (action === 'dict_permission' && interaction.isStringSelectMenu()) {
    await updateAndRefresh(interaction, guildId, parsed.userId, {
      dictionaryPermission: interaction.values[0] as GuildSettings['dictionaryPermission'],
    }, 'permission');
    return;
  }
}

async function handleToggle(
  interaction: ButtonInteraction,
  parsed: ParsedId,
  action: string,
): Promise<void> {
  const guildId = interaction.guildId!;
  const settings = await getGuildSettings(guildId);

  const toggleMap: Record<string, { field: keyof Omit<GuildSettings, 'guildId'>; category: Category }> = {
    toggle_read_username: { field: 'readUsername', category: 'reading' },
    toggle_san_suffix: { field: 'addSanSuffix', category: 'reading' },
    toggle_romaji: { field: 'romajiReading', category: 'reading' },
    toggle_join_leave: { field: 'joinLeaveNotification', category: 'notification' },
    toggle_greeting: { field: 'greetingOnJoin', category: 'notification' },
  };

  const mapping = toggleMap[action];
  if (!mapping) return;

  const currentValue = settings[mapping.field] as boolean;
  await updateAndRefresh(interaction, guildId, parsed.userId, {
    [mapping.field]: !currentValue,
  }, mapping.category);
}

async function showMaxLengthModal(interaction: ButtonInteraction, parsed: ParsedId): Promise<void> {
  const guildId = interaction.guildId!;
  const settings = await getGuildSettings(guildId);
  const isPremium = await isGuildPremium(guildId);
  const maxAllowed = isPremium ? LIMITS.PREMIUM_MAX_READ_LENGTH : LIMITS.FREE_MAX_READ_LENGTH;

  const modal = new ModalBuilder()
    .setCustomId(buildCustomId('settings', 'modal_max_length', parsed.userId))
    .setTitle('読み上げ最大文字数の変更');

  const input = new TextInputBuilder()
    .setCustomId('max_length_value')
    .setLabel(`最大文字数 (1〜${maxAllowed})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`例: ${maxAllowed}`)
    .setValue(settings.maxReadLength.toString())
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
  await interaction.showModal(modal);
}

async function handleMaxLengthSubmit(
  interaction: ModalSubmitInteraction,
  parsed: ParsedId,
): Promise<void> {
  const guildId = interaction.guildId!;
  const isPremium = await isGuildPremium(guildId);
  const maxAllowed = isPremium ? LIMITS.PREMIUM_MAX_READ_LENGTH : LIMITS.FREE_MAX_READ_LENGTH;

  const raw = interaction.fields.getTextInputValue('max_length_value');
  const value = parseInt(raw, 10);

  if (isNaN(value) || value < 1 || value > maxAllowed) {
    await interaction.reply({
      content: `最大文字数は 1 〜 ${maxAllowed} の範囲で入力してください。${!isPremium ? '（PREMIUM サーバーでは最大200まで設定可能です）' : ''}`,
      ephemeral: true,
    });
    return;
  }

  await updateGuildSettings(guildId, { maxReadLength: value });
  await interaction.reply({
    content: `読み上げ最大文字数を **${value}** に変更しました。`,
    ephemeral: true,
  });
}

async function updateAndRefresh(
  interaction:
    | StringSelectMenuInteraction
    | ButtonInteraction
    | RoleSelectMenuInteraction
    | ChannelSelectMenuInteraction,
  guildId: string,
  userId: string,
  updates: Partial<Omit<GuildSettings, 'guildId'>>,
  category: Category,
): Promise<void> {
  const settings = await updateGuildSettings(guildId, updates);
  const { components } = buildSettingsMessage(settings, category, userId);
  await interaction.update({ components });
}
