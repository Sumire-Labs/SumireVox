export interface BotInstance {
  instanceId: number;
  botUserId: string;
  clientId: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BotInstanceSettings {
  autoJoin: boolean;
  textChannelId: string | null;
  voiceChannelId: string | null;
}

// guildSettings.botInstanceSettings の型
// キーは BOT_INSTANCE_ID の文字列 ("1", "2", ...)
export type GuildBotInstanceSettingsMap = Record<string, BotInstanceSettings>;
