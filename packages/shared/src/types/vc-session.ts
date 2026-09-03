export type VcSessionConnectionMode = 'manual' | 'auto';

export interface VcSession {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  shardId: number;
  botInstanceId: number;
  /** Redis VC ownership lease. 旧セッションには存在しない。 */
  claimId?: string;
  /** 旧Redisセッションには存在しないため任意。未設定は manual として扱う。 */
  connectionMode?: VcSessionConnectionMode;
}
