import type { VcSessionConnectionMode } from '@sumirevox/shared';
import { REDIS_KEYS } from '@sumirevox/shared';
import { getRedisClient } from '../infrastructure/redis.js';
import { delegateBotCommand } from './bot-command-delegation-service.js';
import { getAvailableBotInstanceIds } from './premium-service.js';

const MAX_REEVALUATION_PASSES = 3;

export type VcAllocationStatus =
  | 'connected'
  | 'updated'
  | 'already-connected'
  | 'capacity'
  | 'failed';

export interface VcAllocationRequest {
  guildId: string;
  voiceChannelId: string;
  textChannelId: string;
  connectionMode: VcSessionConnectionMode;
  /** 自動接続は既存の手動セッションを変更しない。 */
  existingOwnerBehavior: 'update' | 'preserve';
}

export interface VcAllocationResult {
  status: VcAllocationStatus;
  instanceId?: number;
  message?: string;
}

export interface VcAllocationInspection {
  status: 'existing' | 'candidate' | 'capacity';
  instanceId?: number;
}

/**
 * 接続前の軽量な割当状況を確認する。
 * /join が容量不足をEphemeralで返すための事前判定にも使う。
 */
export async function inspectVoiceConnectionAllocation(
  guildId: string,
  voiceChannelId: string,
): Promise<VcAllocationInspection> {
  const ownerInstanceId = await findOwningInstance(guildId, voiceChannelId);
  if (ownerInstanceId !== undefined) {
    return { status: 'existing', instanceId: ownerInstanceId };
  }

  const candidateInstanceId = await findFreeCandidate(guildId);
  return candidateInstanceId === undefined
    ? { status: 'capacity' }
    : { status: 'candidate', instanceId: candidateInstanceId };
}

/** 手動・自動の接続要求に共通するBot割当処理。 */
export async function allocateVoiceConnection(
  request: VcAllocationRequest,
): Promise<VcAllocationResult> {
  let lastFailureMessage: string | undefined;

  for (let pass = 0; pass < MAX_REEVALUATION_PASSES; pass += 1) {
    const ownerInstanceId = await findOwningInstance(request.guildId, request.voiceChannelId);
    if (ownerInstanceId !== undefined) {
      if (request.existingOwnerBehavior === 'preserve') {
        return { status: 'already-connected', instanceId: ownerInstanceId };
      }

      const result = await delegateJoin(ownerInstanceId, request);
      if (result.success) {
        return {
          status: result.operation === 'updated' ? 'updated' : 'already-connected',
          instanceId: ownerInstanceId,
        };
      }
      lastFailureMessage = result.message;
      continue;
    }

    const candidates = await getAvailableBotInstanceIds(request.guildId);
    let attempted = false;
    let claimConflict = false;

    for (const instanceId of candidates) {
      if (await isBotClaimed(request.guildId, instanceId)) continue;

      attempted = true;
      const result = await delegateJoin(instanceId, request);
      if (result.success) {
        return {
          status: result.operation === 'updated'
            ? 'updated'
            : result.operation === 'existing'
              ? 'already-connected'
              : 'connected',
          instanceId,
        };
      }

      lastFailureMessage = result.message;
      const ownerAfterFailure = await findOwningInstance(request.guildId, request.voiceChannelId);
      if (ownerAfterFailure !== undefined) {
        claimConflict = true;
        break;
      }
      if (await isBotClaimed(request.guildId, instanceId)) {
        claimConflict = true;
      }
    }

    const ownerAfterCandidates = await findOwningInstance(request.guildId, request.voiceChannelId);
    if (ownerAfterCandidates !== undefined || claimConflict) continue;
    if (!attempted) return { status: 'capacity' };
    return {
      status: 'failed',
      message: lastFailureMessage ?? 'ボイスチャンネルへの接続に失敗しました。',
    };
  }

  return {
    status: 'failed',
    message: lastFailureMessage ?? '接続競合のためボイスチャンネルに接続できませんでした。',
  };
}

async function delegateJoin(
  instanceId: number,
  request: VcAllocationRequest,
): Promise<{
  success: boolean;
  operation?: 'created' | 'updated' | 'existing';
  message?: string;
}> {
  const result = await delegateBotCommand(instanceId, {
    action: 'join',
    guildId: request.guildId,
    voiceChannelId: request.voiceChannelId,
    textChannelId: request.textChannelId,
    connectionMode: request.connectionMode,
  });
  return {
    success: result.success,
    operation: result.operation === 'left' ? undefined : result.operation,
    message: result.message,
  };
}

async function findFreeCandidate(
  guildId: string,
): Promise<number | undefined> {
  const candidates = await getAvailableBotInstanceIds(guildId);
  for (const instanceId of candidates) {
    if (!(await isBotClaimed(guildId, instanceId))) return instanceId;
  }
  return undefined;
}

async function isBotClaimed(guildId: string, instanceId: number): Promise<boolean> {
  return (await getRedisClient().get(REDIS_KEYS.BOT_VC_CLAIM(guildId, instanceId))) !== null;
}

async function findOwningInstance(
  guildId: string,
  voiceChannelId: string,
): Promise<number | undefined> {
  const value = await getRedisClient().get(REDIS_KEYS.VC_CLAIM(guildId, voiceChannelId));
  if (!value) return undefined;

  const instanceId = Number(value.split(':', 1)[0]);
  return Number.isInteger(instanceId) && instanceId > 0 ? instanceId : undefined;
}
