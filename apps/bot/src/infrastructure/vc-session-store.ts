import { VcSession } from '@sumirevox/shared';
import { REDIS_KEYS } from '@sumirevox/shared';
import { logger } from './logger.js';
import { getRedisClient } from './redis.js';
import { config } from './config.js';

export async function saveVcSessionToRedis(session: VcSession): Promise<void> {
  try {
    await getRedisClient().set(
      REDIS_KEYS.VC_SESSION(session.guildId, session.botInstanceId),
      JSON.stringify(session),
    );
  } catch (err) {
    logger.error({ err, guildId: session.guildId }, 'Failed to save VC session to Redis');
  }
}

export async function getVcSessionFromRedis(
  guildId: string,
  botInstanceId: number,
): Promise<VcSession | null> {
  try {
    const value = await getRedisClient().get(REDIS_KEYS.VC_SESSION(guildId, botInstanceId));
    if (!value) return null;
    return JSON.parse(value) as VcSession;
  } catch (err) {
    logger.error({ err, guildId }, 'Failed to get VC session from Redis');
    return null;
  }
}

export async function removeVcSessionFromRedis(
  guildId: string,
  botInstanceId: number,
): Promise<void> {
  try {
    await getRedisClient().del(REDIS_KEYS.VC_SESSION(guildId, botInstanceId));
  } catch (err) {
    logger.error({ err, guildId }, 'Failed to remove VC session from Redis');
  }
}

export async function getAllVcSessionsForShard(shardId: number): Promise<VcSession[]> {
  const client = getRedisClient();
  const sessions: VcSession[] = [];

  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', 'vc-session:*:*', 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length === 0) continue;

      const values = await client.mget(...keys);
      for (const value of values) {
        if (!value) continue;
        const session = JSON.parse(value) as VcSession;
        if (session.shardId === shardId && session.botInstanceId === config.botInstanceId) {
          sessions.push(session);
        }
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.error({ err, shardId }, 'Failed to get VC sessions for shard from Redis');
  }

  return sessions;
}
