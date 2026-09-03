export interface BotInstance {
  instanceId: number;
  botUserId: string;
  clientId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutoJoinChannelPair {
  voiceChannelId: string;
  textChannelId: string;
}

export interface BotInstanceSettings {
  autoJoin: boolean;
  textChannelId: string | null;
  voiceChannelId: string | null;
  /** 新形式の自動接続先。未設定の場合は旧フィールドから復元する。 */
  channelPairs?: AutoJoinChannelPair[];
}

/** getInstanceSettings が返す正規化済みの Bot 設定 */
export interface ResolvedBotInstanceSettings extends BotInstanceSettings {
  channelPairs: AutoJoinChannelPair[];
}

/** 全Botで共有する自動接続設定。保存時は旧VC/TCフィールドを持たない。 */
export interface AutoJoinSettings {
  autoJoin: boolean;
  channelPairs?: AutoJoinChannelPair[];
}

export interface ResolvedAutoJoinSettings extends AutoJoinSettings {
  channelPairs: AutoJoinChannelPair[];
}

// guildSettings.botInstanceSettings の型
// キーは BOT_INSTANCE_ID の文字列 ("1", "2", ...)
export type GuildBotInstanceSettingsMap = Record<string, BotInstanceSettings>;
