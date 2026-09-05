import { randomUUID } from 'node:crypto';
import { REDIS_KEYS } from '@sumirevox/shared';
import { getRedisClient } from '../infrastructure/redis.js';
import { logger } from '../infrastructure/logger.js';

export const VC_OWNERSHIP_LEASE_TTL_MS = 3_000;
const RECOVERY_LEASE_BUFFER_MS = 250;

export interface VcOwnership {
  instanceId: number;
  claimId: string;
}

const claimScript = `
local channel = redis.call('GET', KEYS[1])
local bot = redis.call('GET', KEYS[2])
if (channel and channel ~= ARGV[1]) or (bot and bot ~= ARGV[1]) then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2])
redis.call('SET', KEYS[2], ARGV[1], 'PX', ARGV[2])
return 1`;

const renewScript = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
redis.call('PEXPIRE', KEYS[1], ARGV[2])
redis.call('PEXPIRE', KEYS[2], ARGV[2])
return 1`;

const renewMoveScript = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[2] or redis.call('GET', KEYS[3]) ~= ARGV[2] then return 0 end
redis.call('PEXPIRE', KEYS[1], ARGV[3])
redis.call('PEXPIRE', KEYS[2], ARGV[3])
redis.call('PEXPIRE', KEYS[3], ARGV[3])
return 1`;

const releaseScript = `
if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]) end
if redis.call('GET', KEYS[2]) == ARGV[1] then redis.call('DEL', KEYS[2]) end
return 1`;

const moveScript = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
if redis.call('GET', KEYS[3]) then return 0 end
redis.call('SET', KEYS[3], ARGV[2], 'PX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'PX', ARGV[3])
return 1`;

const rollbackMoveScript = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[2] then return 0 end
redis.call('DEL', KEYS[2])
redis.call('SET', KEYS[3], ARGV[1], 'PX', ARGV[3])
return 1`;

function claimValue(instanceId: number, claimId: string): string {
  return `${instanceId}:${claimId}`;
}

export async function claimVcOwnership(
  guildId: string,
  voiceChannelId: string,
  instanceId: number,
  existingClaimId?: string,
): Promise<VcOwnership | null> {
  const claimId = existingClaimId ?? randomUUID();
  const value = claimValue(instanceId, claimId);
  const result = await getRedisClient().eval(
    claimScript,
    2,
    REDIS_KEYS.VC_CLAIM(guildId, voiceChannelId),
    REDIS_KEYS.BOT_VC_CLAIM(guildId, instanceId),
    value,
    String(VC_OWNERSHIP_LEASE_TTL_MS),
  );
  if (result !== 1) return null;
  return { instanceId, claimId };
}

export async function renewVcOwnership(
  guildId: string,
  voiceChannelId: string,
  ownership: VcOwnership,
): Promise<boolean> {
  const result = await getRedisClient().eval(
    renewScript,
    2,
    REDIS_KEYS.VC_CLAIM(guildId, voiceChannelId),
    REDIS_KEYS.BOT_VC_CLAIM(guildId, ownership.instanceId),
    claimValue(ownership.instanceId, ownership.claimId),
    String(VC_OWNERSHIP_LEASE_TTL_MS),
  );
  return result === 1;
}

/** VC移動中の旧VC・新VC・Bot claimをまとめて更新する。 */
export async function renewVcOwnershipMove(
  guildId: string,
  fromVoiceChannelId: string,
  toVoiceChannelId: string,
  previous: VcOwnership,
  current: VcOwnership,
): Promise<boolean> {
  const result = await getRedisClient().eval(
    renewMoveScript,
    3,
    REDIS_KEYS.VC_CLAIM(guildId, fromVoiceChannelId),
    REDIS_KEYS.VC_CLAIM(guildId, toVoiceChannelId),
    REDIS_KEYS.BOT_VC_CLAIM(guildId, current.instanceId),
    claimValue(previous.instanceId, previous.claimId),
    claimValue(current.instanceId, current.claimId),
    String(VC_OWNERSHIP_LEASE_TTL_MS),
  );
  return result === 1;
}

export async function moveVcOwnership(
  guildId: string,
  fromVoiceChannelId: string,
  toVoiceChannelId: string,
  ownership: VcOwnership,
): Promise<VcOwnership | null> {
  const next: VcOwnership = { instanceId: ownership.instanceId, claimId: randomUUID() };
  const result = await getRedisClient().eval(
    moveScript,
    3,
    REDIS_KEYS.VC_CLAIM(guildId, fromVoiceChannelId),
    REDIS_KEYS.BOT_VC_CLAIM(guildId, ownership.instanceId),
    REDIS_KEYS.VC_CLAIM(guildId, toVoiceChannelId),
    claimValue(ownership.instanceId, ownership.claimId),
    claimValue(next.instanceId, next.claimId),
    String(VC_OWNERSHIP_LEASE_TTL_MS),
  );
  return result === 1 ? next : null;
}

export async function rollbackVcOwnershipMove(
  guildId: string,
  fromVoiceChannelId: string,
  toVoiceChannelId: string,
  previous: VcOwnership,
  current: VcOwnership,
): Promise<void> {
  await getRedisClient().eval(
    rollbackMoveScript,
    3,
    REDIS_KEYS.VC_CLAIM(guildId, fromVoiceChannelId),
    REDIS_KEYS.VC_CLAIM(guildId, toVoiceChannelId),
    REDIS_KEYS.BOT_VC_CLAIM(guildId, previous.instanceId),
    claimValue(previous.instanceId, previous.claimId),
    claimValue(current.instanceId, current.claimId),
    String(VC_OWNERSHIP_LEASE_TTL_MS),
  );
}

export async function releaseVcOwnership(
  guildId: string,
  voiceChannelId: string,
  ownership: VcOwnership,
): Promise<void> {
  try {
    await getRedisClient().eval(
      releaseScript,
      2,
      REDIS_KEYS.VC_CLAIM(guildId, voiceChannelId),
      REDIS_KEYS.BOT_VC_CLAIM(guildId, ownership.instanceId),
      claimValue(ownership.instanceId, ownership.claimId),
    );
  } catch (error) {
    logger.error({ err: error, guildId, voiceChannelId }, 'Failed to release VC ownership');
  }
}

/**
 * 復旧時に既存leaseが切れるまでの安全な待機時間を返す。
 * Redis障害時は短いバックオフを返し、呼び出し側で復旧記録を保持する。
 */
export async function getVcOwnershipRecoveryDelayMs(
  guildId: string,
  voiceChannelId: string,
  instanceId: number,
): Promise<number> {
  try {
    const redis = getRedisClient();
    const [channelTtl, botTtl] = await Promise.all([
      redis.pttl(REDIS_KEYS.VC_CLAIM(guildId, voiceChannelId)),
      redis.pttl(REDIS_KEYS.BOT_VC_CLAIM(guildId, instanceId)),
    ]);
    const ttl = Math.max(normalizeLeaseTtl(channelTtl), normalizeLeaseTtl(botTtl));
    return ttl > 0 ? ttl + RECOVERY_LEASE_BUFFER_MS : 0;
  } catch (error) {
    logger.warn({ err: error, guildId, voiceChannelId }, 'Failed to read VC ownership lease TTL');
    return 5_000;
  }
}

function normalizeLeaseTtl(ttl: number): number {
  if (ttl > 0) return ttl;
  // 永続キーは想定外だが、即時奪取を避けるため通常leaseと同じ待機にする。
  return ttl === -1 ? VC_OWNERSHIP_LEASE_TTL_MS : 0;
}
