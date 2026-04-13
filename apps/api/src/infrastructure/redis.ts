import { Redis } from 'ioredis';
import { config } from './config.js';
import { logger } from './logger.js';

let redisClient: Redis | null = null;
let redisSubscriber: Redis | null = null;
let redisPublisher: Redis | null = null;
let redisReady = false;

type RedisInstanceName = 'client' | 'subscriber' | 'publisher';

function createRedisInstance(name: RedisInstanceName): Redis {
  const client = new Redis(config.redisUrl, {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    retryStrategy: (attempt: number) => Math.min(attempt * 200, 5000),
  });

  client.on('ready', () => {
    if (name === 'client') {
      redisReady = true;
    }
    logger.info(`Redis ${name} connected`);
  });

  client.on('error', (err: Error) => {
    if (name === 'client') {
      redisReady = false;
    }
    logger.error({ err }, `Redis ${name} error`);
  });

  client.on('close', () => {
    if (name === 'client') {
      redisReady = false;
    }
    logger.warn(`Redis ${name} connection closed`);
  });

  client.on('end', () => {
    if (name === 'client') {
      redisReady = false;
    }
    logger.warn(`Redis ${name} connection ended`);
  });

  client.on('reconnecting', (delay: number) => {
    if (name === 'client') {
      redisReady = false;
    }
    logger.warn({ delay }, `Redis ${name} reconnecting`);
  });

  return client;
}

export function isRedisReady(): boolean {
  return redisReady;
}

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = createRedisInstance('client');
  }
  return redisClient;
}

export function getRedisSubscriber(): Redis {
  if (!redisSubscriber) {
    redisSubscriber = createRedisInstance('subscriber');
  }
  return redisSubscriber;
}

export function getRedisPublisher(): Redis {
  if (!redisPublisher) {
    redisPublisher = createRedisInstance('publisher');
  }
  return redisPublisher;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.all(
    [redisClient, redisSubscriber, redisPublisher]
      .filter((instance): instance is Redis => instance !== null)
      .map((instance) => instance.quit()),
  );
  redisClient = null;
  redisSubscriber = null;
  redisPublisher = null;
}
