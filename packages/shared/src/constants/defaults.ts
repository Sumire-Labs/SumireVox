import type { GuildSettings } from '../types/guild-settings.js';
import type { BotInstanceSettings } from '../types/bot-instance.js';

export const GUILD_SETTINGS_DEFAULTS: Omit<GuildSettings, 'guildId'> = {
  maxReadLength: 50,
  readUsername: false,
  addSanSuffix: false,
  romajiReading: false,
  joinLeaveNotification: false,
  greetingOnJoin: false,
  customEmojiHandling: 'read_name',
  readTargetType: 'text_only',
  autoJoin: false,
  defaultTextChannelId: null,
  defaultSpeakerId: null,
  adminRoleId: null,
  dictionaryPermission: 'admin_only',
  manualPremium: false,
};

export const DEFAULT_BOT_INSTANCE_SETTINGS: BotInstanceSettings = {
  autoJoin: false,
  textChannelId: null,
  voiceChannelId: null,
};
