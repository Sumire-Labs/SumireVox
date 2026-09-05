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
import {
  GuildSettings,
  buildCustomId,
  parseCustomId,
  LIMITS,
  AutoJoinChannelPair,
  BotInstance,
  BotInstanceSettings,
  AutoJoinSettings,
  normalizeAutoJoinSettings,
} from '@sumirevox/shared';
import { getGuildSettings, getAutoJoinSettings, getInstanceSettings } from '../services/guild-settings-service.js';
import {
  copyBotInstanceSettings,
  updateGuildSettings,
  updateAutoJoinSettings,
} from '../services/guild-settings-update-service.js';
import { getCopyableBotInstances } from '../services/bot-instance-registry.js';
import { getSpeakers, getSpeakerStyleName } from '../services/voicevox-speaker-cache.js';
import { isGuildPremium } from '../services/premium-service.js';
import { getClient } from '../infrastructure/discord-client.js';
import { config } from '../infrastructure/config.js';
import { AppError } from '../infrastructure/app-error.js';

type ParsedId = NonNullable<ReturnType<typeof parseCustomId>>;

const CATEGORIES = [
  { value: 'reading', label: '読み上げ設定', emoji: '📖' },
  { value: 'notification', label: '通知設定', emoji: '🔔' },
  { value: 'filter', label: 'フィルタ設定', emoji: '🔧' },
  { value: 'connection', label: '接続設定', emoji: '🔗' },
  { value: 'permission', label: '権限設定', emoji: '🔒' },
] as const;

type Category = (typeof CATEGORIES)[number]['value'];

interface PendingCopySelection {
  guildId: string;
  sourceInstanceId: number;
  targetIds: number[];
  targetNames: string[];
  createdAt: number;
}

const pendingCopySelections = new Map<string, PendingCopySelection>();

export function buildSettingsMessage(
  settings: GuildSettings,
  category: Category,
  userId: string,
  instanceSettings: AutoJoinSettings,
  botName: string = 'SumireVox',
): { components: ContainerBuilder[] } {
  const mainContainer = buildSettingsNavigation(category, userId);
  const categoryContainer = buildCategoryContainer(
    settings,
    category,
    userId,
    instanceSettings,
    botName,
  );

  return { components: [mainContainer, categoryContainer] };
}

function buildSettingsNavigation(category: Category, userId: string): ContainerBuilder {
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
      new TextDisplayBuilder().setContent('カテゴリを選択して設定を変更してください。'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categorySelect),
    );

  return mainContainer;
}

function buildCategoryContainer(
  settings: GuildSettings,
  category: Category,
  userId: string,
  instanceSettings: AutoJoinSettings,
  botName: string,
): ContainerBuilder {
  switch (category) {
    case 'reading':
      return buildReadingCategory(settings, userId);
    case 'notification':
      return buildNotificationCategory(settings, userId);
    case 'filter':
      return buildFilterCategory(settings, userId);
    case 'connection':
      return buildConnectionCategory(userId, instanceSettings, botName);
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
            `**ローマ字ひらがな変換:** ${settings.romajiReading ? 'ON' : 'OFF'}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'toggle_romaji', userId))
            .setLabel(settings.romajiReading ? '✓ ON' : 'OFF')
            .setStyle(settings.romajiReading ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**大文字ローマ字読み:** ${settings.uppercaseReading ? 'ON' : 'OFF'}`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'toggle_uppercase_reading', userId))
            .setLabel(settings.uppercaseReading ? '✓ ON' : 'OFF')
            .setStyle(settings.uppercaseReading ? ButtonStyle.Success : ButtonStyle.Secondary),
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

function buildConnectionCategory(
  userId: string,
  instanceSettings: AutoJoinSettings,
  botName: string,
): ContainerBuilder {
  const resolvedSettings = normalizeAutoJoinSettings(instanceSettings);
  const { autoJoin, channelPairs } = resolvedSettings;

  const container = new ContainerBuilder().setAccentColor(0x7c3aed);
  const pairText = channelPairs.length === 0
    ? '未設定'
    : channelPairs
      .map(
        (pair, index) =>
          `**${index + 1}.** VC <#${pair.voiceChannelId}> → TC <#${pair.textChannelId}>`,
      )
      .join('\n');

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 🔗 接続設定'))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('**全Bot共通** の自動接続設定'),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    )
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(
            `**自動接続:** ${autoJoin ? 'ON' : 'OFF'}\nユーザーが VC に参加したとき自動で接続します。`,
          ),
        )
        .setButtonAccessory(
          new ButtonBuilder()
            .setCustomId(buildCustomId('settings', 'toggle_auto_join', userId))
            .setLabel(autoJoin ? '✓ ON' : 'OFF')
            .setStyle(autoJoin ? ButtonStyle.Success : ButtonStyle.Secondary),
        ),
    )
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small),
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**自動接続対象ペア (${channelPairs.length}/${LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS})**\n${pairText}`,
      ),
    );

  if (channelPairs.length > 0) {
    const removeSelect = new StringSelectMenuBuilder()
      .setCustomId(buildCustomId('settings', 'pair_remove', userId))
      .setPlaceholder('削除するペアを選択')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        channelPairs.map((pair, index) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`ペア${index + 1}: VC ${pair.voiceChannelId}`)
            .setDescription(`TC ${pair.textChannelId}`)
            .setValue(pair.voiceChannelId),
        ),
      );
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(removeSelect),
    );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('settings', 'pair_add', userId))
        .setLabel('チャンネルペアを追加')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(channelPairs.length >= LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS),
    ),
  );

  return container;
}

function buildSettingsFlowMessage(
  userId: string,
  flowContainer: ContainerBuilder,
): { components: ContainerBuilder[] } {
  return {
    components: [buildSettingsNavigation('connection', userId), flowContainer],
  };
}

function buildPairAddContainer(
  userId: string,
  selectedVoiceChannelId?: string,
): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0x7c3aed);
  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### ➕ チャンネルペアを追加'))
    .addSeparatorComponents(
      new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small),
    );

  if (!selectedVoiceChannelId) {
    const voiceSelect = new ChannelSelectMenuBuilder()
      .setCustomId(buildCustomId('settings', 'pair_add_voice', userId))
      .setPlaceholder('VC チャンネルを選択')
      .setChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setMinValues(1)
      .setMaxValues(1);
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('自動接続の対象にするVCを選択してください。'),
      )
      .addActionRowComponents(
        new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(voiceSelect),
      );
  } else {
    const textSelect = new ChannelSelectMenuBuilder()
      .setCustomId(buildCustomId('settings', `pair_add_text:${selectedVoiceChannelId}`, userId))
      .setPlaceholder('読み上げチャンネルを選択（VC内テキストチャットも可）')
      .setChannelTypes(
        ChannelType.GuildText,
        ChannelType.GuildAnnouncement,
        ChannelType.GuildVoice,
        ChannelType.GuildStageVoice,
      )
      .setMinValues(1)
      .setMaxValues(1);
    container
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `VC <#${selectedVoiceChannelId}> を選択しました。読み上げ先のTCを選択してください。`,
        ),
      )
      .addActionRowComponents(
        new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(textSelect),
      );
  }

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(buildCustomId('settings', 'pair_add_cancel', userId))
        .setLabel('キャンセル')
        .setStyle(ButtonStyle.Secondary),
    ),
  );
  return container;
}

function buildCopySelectionContainer(
  userId: string,
  candidates: readonly BotInstance[],
): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0x7c3aed);
  const select = new StringSelectMenuBuilder()
    .setCustomId(buildCustomId('settings', 'copy_select', userId))
    .setPlaceholder('コピー先のBotを選択（複数可）')
    .setMinValues(1)
    .setMaxValues(candidates.length)
    .addOptions(
      candidates.map((candidate) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(truncateLabel(`#${candidate.instanceId} ${candidate.name}`))
          .setDescription(`Botインスタンス ${candidate.instanceId}`)
          .setValue(String(candidate.instanceId)),
      ),
    );

  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### 📋 設定を他のBotへコピー'))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        'コピー先を複数選択してください。選択後に上書き確認を行います。',
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(buildCustomId('settings', 'copy_cancel', userId))
          .setLabel('キャンセル')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  return container;
}

function buildCopyConfirmationContainer(
  userId: string,
  targetNames: readonly string[],
  confirmationCustomId: string,
): ContainerBuilder {
  const container = new ContainerBuilder().setAccentColor(0xf59e0b);
  const names = targetNames.map((name) => `・${name}`).join('\n');
  container
    .addTextDisplayComponents(new TextDisplayBuilder().setContent('### ⚠️ 設定の上書き確認'))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `以下のBotの自動接続設定を、現在のBotの設定で完全に上書きします。\n${names}`,
      ),
    )
    .addActionRowComponents(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(confirmationCustomId)
          .setLabel('上書きしてコピー')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(buildCustomId('settings', 'copy_cancel', userId))
          .setLabel('キャンセル')
          .setStyle(ButtonStyle.Secondary),
      ),
    );
  return container;
}

function truncateLabel(value: string): string {
  return value.length <= 100 ? value : `${value.slice(0, 97)}...`;
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
    const instanceSettings = getAutoJoinSettings(settings);
    const botName = getClient().user?.username ?? 'SumireVox';
    const { components } = buildSettingsMessage(settings, category, parsed.userId, instanceSettings, botName);
    await interaction.update({ components });
    return;
  }

  if (action === 'toggle_auto_join' && interaction.isButton()) {
    const settings = await getGuildSettings(guildId);
    const instanceSettings = getAutoJoinSettings(settings);
    await updateInstanceAndRefresh(interaction, guildId, parsed.userId, {
      autoJoin: !instanceSettings.autoJoin,
    });
    return;
  }

  if (action === 'pair_add' && interaction.isButton()) {
    await showPairAddView(interaction, parsed.userId, guildId);
    return;
  }

  if (action === 'pair_add_voice' && interaction.isChannelSelectMenu()) {
    await handlePairAddVoice(interaction, parsed.userId, guildId);
    return;
  }

  if (action.startsWith('pair_add_text:') && interaction.isChannelSelectMenu()) {
    await handlePairAddText(interaction, parsed.userId, guildId, action);
    return;
  }

  if (action === 'pair_add_cancel' && interaction.isButton()) {
    await refreshInstanceView(interaction, guildId, parsed.userId);
    return;
  }

  if (action === 'pair_remove' && interaction.isStringSelectMenu()) {
    await handlePairRemove(interaction, parsed.userId, guildId, interaction.values[0]);
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

type SettingsComponentInteraction =
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ChannelSelectMenuInteraction;

async function showPairAddView(
  interaction: ButtonInteraction,
  userId: string,
  guildId: string,
): Promise<void> {
  try {
    const settings = await getGuildSettings(guildId);
    const instanceSettings = getAutoJoinSettings(settings);
    if (instanceSettings.channelPairs.length >= LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS) {
      await replySettingsError(
        interaction,
        new AppError(
          'VALIDATION_ERROR',
          `自動接続ペアは${LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS}件までです。`,
        ),
      );
      return;
    }

    await interaction.update(
      buildSettingsFlowMessage(userId, buildPairAddContainer(userId)),
    );
  } catch (error) {
    await replySettingsError(interaction, error);
  }
}

async function handlePairAddVoice(
  interaction: ChannelSelectMenuInteraction,
  userId: string,
  guildId: string,
): Promise<void> {
  const voiceChannelId = interaction.values[0];
  const voiceChannel = interaction.guild?.channels.cache.get(voiceChannelId);
  if (!voiceChannel?.isVoiceBased()) {
    await replySettingsError(
      interaction,
      new AppError('VALIDATION_ERROR', '有効なVCを選択してください。'),
    );
    return;
  }

  try {
    const settings = await getGuildSettings(guildId);
    const instanceSettings = getAutoJoinSettings(settings);
    if (instanceSettings.channelPairs.length >= LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS) {
      throw new AppError(
        'VALIDATION_ERROR',
        `自動接続ペアは${LIMITS.MAX_AUTO_JOIN_CHANNEL_PAIRS}件までです。`,
      );
    }
    if (instanceSettings.channelPairs.some((pair) => pair.voiceChannelId === voiceChannelId)) {
      throw new AppError('VALIDATION_ERROR', '同じVCを複数のペアに登録できません。');
    }

    await interaction.update(
      buildSettingsFlowMessage(userId, buildPairAddContainer(userId, voiceChannelId)),
    );
  } catch (error) {
    await replySettingsError(interaction, error);
  }
}

async function handlePairAddText(
  interaction: ChannelSelectMenuInteraction,
  userId: string,
  guildId: string,
  action: string,
): Promise<void> {
  const voiceChannelId = action.slice('pair_add_text:'.length);
  const textChannelId = interaction.values[0];
  const voiceChannel = interaction.guild?.channels.cache.get(voiceChannelId);
  const textChannel = interaction.guild?.channels.cache.get(textChannelId);
  if (!voiceChannel?.isVoiceBased() || !textChannel?.isTextBased() || !voiceChannelId) {
    await replySettingsError(
      interaction,
      new AppError('VALIDATION_ERROR', '有効なTCを選択してください。'),
    );
    return;
  }

  try {
    const settings = await getGuildSettings(guildId);
    const instanceSettings = getInstanceSettings(settings, config.botInstanceId);
    if (instanceSettings.channelPairs.some((pair) => pair.voiceChannelId === voiceChannelId)) {
      throw new AppError('VALIDATION_ERROR', '同じVCを複数のペアに登録できません。');
    }

    const pair: AutoJoinChannelPair = { voiceChannelId, textChannelId };
    await updateAutoJoinSettings(guildId, {
      channelPairs: [...instanceSettings.channelPairs, pair],
    });
    await refreshInstanceView(interaction, guildId, userId);
  } catch (error) {
    await replySettingsError(interaction, error);
  }
}

async function handlePairRemove(
  interaction: StringSelectMenuInteraction,
  userId: string,
  guildId: string,
  voiceChannelId: string | undefined,
): Promise<void> {
  if (!voiceChannelId) {
    await replySettingsError(
      interaction,
      new AppError('VALIDATION_ERROR', '削除するペアを選択してください。'),
    );
    return;
  }

  try {
    const settings = await getGuildSettings(guildId);
    const instanceSettings = getAutoJoinSettings(settings);
    const channelPairs = instanceSettings.channelPairs.filter(
      (pair) => pair.voiceChannelId !== voiceChannelId,
    );
    if (channelPairs.length === instanceSettings.channelPairs.length) {
      throw new AppError('VALIDATION_ERROR', '選択したペアはすでに削除されています。');
    }

    await updateAutoJoinSettings(guildId, { channelPairs });
    await refreshInstanceView(interaction, guildId, userId);
  } catch (error) {
    await replySettingsError(interaction, error);
  }
}

async function showCopySelectionView(
  interaction: ButtonInteraction,
  userId: string,
  guildId: string,
): Promise<void> {
  try {
    clearPendingCopySelections(guildId, userId);
    const candidates = await getCopyableBotInstances(guildId, config.botInstanceId);
    if (candidates.length === 0) {
      await replySettingsError(
        interaction,
        new AppError('VALIDATION_ERROR', 'コピー可能なBotインスタンスがありません。'),
      );
      return;
    }

    await interaction.update({
      components: [
        buildSettingsNavigation('connection', userId),
        buildCopySelectionContainer(userId, candidates),
      ],
    });
  } catch (error) {
    await replySettingsError(interaction, error);
  }
}

async function handleCopySelection(
  interaction: StringSelectMenuInteraction,
  userId: string,
  guildId: string,
  values: readonly string[],
): Promise<void> {
  const targetIds = values.map((value) => Number(value));
  if (
    targetIds.length === 0 ||
    targetIds.some((id) => !Number.isInteger(id) || id <= 0) ||
    new Set(targetIds).size !== targetIds.length
  ) {
    await replySettingsError(
      interaction,
      new AppError('VALIDATION_ERROR', 'コピー先のBotを正しく選択してください。'),
    );
    return;
  }

  try {
    const candidates = await getCopyableBotInstances(guildId, config.botInstanceId);
    const candidateById = new Map(candidates.map((candidate) => [candidate.instanceId, candidate]));
    const selectedCandidates = targetIds.map((targetId) => candidateById.get(targetId));
    if (selectedCandidates.some((candidate) => !candidate)) {
      throw new AppError('VALIDATION_ERROR', 'コピー先のBotが利用できません。選択し直してください。');
    }

    const resolvedCandidates = selectedCandidates.filter(
      (candidate): candidate is BotInstance => candidate !== undefined,
    );
    clearPendingCopySelections(guildId, userId);
    const confirmationCustomId = buildCustomId('settings', 'copy_confirm', userId);
    pendingCopySelections.set(confirmationCustomId, {
      guildId,
      sourceInstanceId: config.botInstanceId,
      targetIds,
      targetNames: resolvedCandidates.map(
        (candidate) => `#${candidate.instanceId} ${candidate.name}`,
      ),
      createdAt: Date.now(),
    });

    await interaction.update({
      components: [
        buildSettingsNavigation('connection', userId),
        buildCopyConfirmationContainer(
          userId,
          resolvedCandidates.map((candidate) => `#${candidate.instanceId} ${candidate.name}`),
          confirmationCustomId,
        ),
      ],
    });
  } catch (error) {
    await replySettingsError(interaction, error);
  }
}

async function handleCopyConfirmation(
  interaction: ButtonInteraction,
  userId: string,
  guildId: string,
  customId: string,
): Promise<void> {
  const pending = pendingCopySelections.get(customId);
  pendingCopySelections.delete(customId);

  if (
    !pending ||
    pending.guildId !== guildId ||
    pending.sourceInstanceId !== config.botInstanceId ||
    Date.now() - pending.createdAt > LIMITS.VIEW_EXPIRY_MINUTES * 60 * 1000
  ) {
    await replySettingsError(
      interaction,
      new AppError('VALIDATION_ERROR', 'コピー操作の期限が切れています。設定画面を開き直してください。'),
    );
    return;
  }

  await interaction.deferUpdate();
  try {
    await copyBotInstanceSettings(guildId, config.botInstanceId, pending.targetIds);
    const components = await getInstanceViewComponents(guildId, userId);
    await interaction.editReply({ components });
    await interaction.followUp({
      content: `自動接続設定を ${pending.targetNames.join('、')} にコピーしました。`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.followUp({
      content: getSettingsErrorMessage(error),
      ephemeral: true,
    });
  }
}

async function refreshInstanceView(
  interaction: SettingsComponentInteraction,
  guildId: string,
  userId: string,
): Promise<void> {
  await interaction.update({ components: await getInstanceViewComponents(guildId, userId) });
}

async function getInstanceViewComponents(
  guildId: string,
  userId: string,
): Promise<ContainerBuilder[]> {
  const settings = await getGuildSettings(guildId);
  const instanceSettings = getAutoJoinSettings(settings);
  const botName = getClient().user?.username ?? 'SumireVox';
  return buildSettingsMessage(
    settings,
    'connection',
    userId,
    instanceSettings,
    botName,
  ).components;
}

function getSettingsErrorMessage(error: unknown): string {
  if (error instanceof AppError) return error.message;
  return '設定の更新に失敗しました。時間をおいて再試行してください。';
}

async function replySettingsError(
  interaction: SettingsComponentInteraction,
  error: unknown,
): Promise<void> {
  const payload = { content: getSettingsErrorMessage(error), ephemeral: true };
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(payload).catch(() => {});
  } else {
    await interaction.reply(payload).catch(() => {});
  }
}

function clearPendingCopySelections(guildId: string, userId: string): void {
  for (const [customId, pending] of pendingCopySelections) {
    if (pending.guildId === guildId && customId.includes(`:${userId}:`)) {
      pendingCopySelections.delete(customId);
    }
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
    toggle_uppercase_reading: { field: 'uppercaseReading', category: 'reading' },
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

  const settings = await updateGuildSettings(guildId, { maxReadLength: value });
  const instanceSettings = getAutoJoinSettings(settings);
  const botName = getClient().user?.username ?? 'SumireVox';
  const { components } = buildSettingsMessage(settings, 'reading', parsed.userId, instanceSettings, botName);

  await interaction.reply({
    content: `読み上げ最大文字数を **${value}** に変更しました。`,
    ephemeral: true,
  });

  if (interaction.message) {
    await interaction.message.edit({ components });
  }
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
  const instanceSettings = getAutoJoinSettings(settings);
  const botName = getClient().user?.username ?? 'SumireVox';
  const { components } = buildSettingsMessage(settings, category, userId, instanceSettings, botName);
  await interaction.update({ components });
}

async function updateInstanceAndRefresh(
  interaction: ButtonInteraction | ChannelSelectMenuInteraction,
  guildId: string,
  userId: string,
  updates: Partial<AutoJoinSettings>,
): Promise<void> {
  await updateAutoJoinSettings(guildId, updates);
  const settings = await getGuildSettings(guildId);
  const instanceSettings = getAutoJoinSettings(settings);
  const botName = getClient().user?.username ?? 'SumireVox';
  const { components } = buildSettingsMessage(settings, 'connection', userId, instanceSettings, botName);
  await interaction.update({ components });
}
