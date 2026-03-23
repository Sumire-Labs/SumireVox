export type CustomEmojiHandling = 'read_name' | 'remove';
export type ReadTargetType = 'text_only' | 'text_and_sticker' | 'text_sticker_and_attachment';
export type DictionaryPermission = 'everyone' | 'admin_only';

export interface GuildSettings {
  guildId: string;
  // 読み上げ設定
  maxReadLength: number;
  readUsername: boolean;
  addSanSuffix: boolean;
  romajiReading: boolean;
  // 通知設定
  joinLeaveNotification: boolean;
  greetingOnJoin: boolean;
  // フィルタ設定
  customEmojiHandling: CustomEmojiHandling;
  readTargetType: ReadTargetType;
  // 接続設定
  autoJoin: boolean;
  defaultTextChannelId: string | null;
  defaultSpeakerId: number | null;
  // 権限設定
  adminRoleId: string | null;
  dictionaryPermission: DictionaryPermission;
  // PREMIUM
  manualPremium: boolean;
}
