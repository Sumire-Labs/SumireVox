import type { GuildSettings } from '../types/guild-settings.js';

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
