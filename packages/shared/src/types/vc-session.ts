export type VcSessionConnectionMode = 'manual' | 'auto';

export interface VcSession {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  shardId: number;
  botInstanceId: number;
  /** 旧Redisセッションには存在しないため任意。未設定は manual として扱う。 */
  connectionMode?: VcSessionConnectionMode;
}
