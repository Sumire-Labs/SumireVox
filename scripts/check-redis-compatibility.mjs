import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const url = new URL(process.env.TEST_REDIS_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'A local test Redis is required');
assert.equal(url.pathname, '/15', 'Use the dedicated test database 15');
const { Redis } = createRequire(resolve('apps/api/package.json'))('ioredis');
const client = new Redis(url.toString(), { lazyConnect: true, retryStrategy: null });
const subscriber = new Redis(url.toString(), { lazyConnect: true, retryStrategy: null });
const key = `sumirevox-upgrade:${randomUUID()}`;
const channel = `${key}:invalidate`;
try {
  await Promise.all([client.connect(), subscriber.connect()]);
  // Session TTL, checkout NX locks, JSON caches and Pub/Sub under RESP3.
  assert.equal(await client.set(key, JSON.stringify({ userId: 'test' }), 'EX', 30, 'NX'), 'OK');
  assert.equal(await client.set(key, 'duplicate', 'EX', 30, 'NX'), null);
  assert.deepEqual(JSON.parse(await client.get(key)), { userId: 'test' });
  assert.ok(await client.ttl(key) > 0);
  assert.deepEqual(await client.mget(key, `${key}:missing`), [JSON.stringify({ userId: 'test' }), null]);
  await subscriber.subscribe(channel);
  const message = once(subscriber, 'message', { signal: AbortSignal.timeout(5000) });
  assert.equal(await client.publish(channel, JSON.stringify({ guildId: '123' })), 1);
  assert.deepEqual(await message, [channel, JSON.stringify({ guildId: '123' })]);
  assert.equal(await client.eval('return redis.call("GET", KEYS[1])', 1, key), JSON.stringify({ userId: 'test' }));
  process.stdout.write('Redis: RESP3 session TTL, NX lock, JSON cache, MGET, Lua and Pub/Sub passed\n');
} finally {
  if (client.status === 'ready') await client.del(key);
  client.disconnect();
  subscriber.disconnect();
}
