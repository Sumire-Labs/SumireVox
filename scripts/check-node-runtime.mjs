import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const app = process.argv[2];
assert.ok(app === 'bot' || app === 'api', 'Usage: node scripts/check-node-runtime.mjs bot|api');
const [major, minor, patch] = process.versions.node.split('.').map(Number);
assert.ok(major === 24 && (minor > 22 || (minor === 22 && patch >= 1)), 'Node.js >=24.22.1 <25 is required');

const requireApp = createRequire(resolve(`apps/${app}/package.json`));
assert.ok(existsSync(`apps/${app}/dist/index.js`), 'Application entry point is missing');
assert.ok(existsSync('packages/shared/dist/index.js'), 'Shared build is missing');
assert.ok(existsSync('apps/bot/prisma/schema.prisma'), 'Prisma schema is missing');
const { PrismaClient } = requireApp('@prisma/client');
const prisma = new PrismaClient();
await prisma.$disconnect();

if (app === 'bot') {
  assert.ok(existsSync('apps/bot/dist/bot.js'), 'Shard entry point is missing');
  assert.ok(existsSync('apps/bot/assets'), 'Bot assets are missing');
  const { ShardingManager } = requireApp('discord.js');
  const manager = new ShardingManager(resolve('apps/bot/dist/bot.js'), { totalShards: 1 });
  assert.equal(manager.totalShards, 1);
  requireApp('@discordjs/voice');

  const { OpusEncoder } = requireApp('@discordjs/opus');
  const encoder = new OpusEncoder(48_000, 2);
  const pcm = Buffer.alloc(960 * 2 * 2);
  const packet = encoder.encode(pcm);
  assert.ok(packet.length > 0);
  assert.equal(encoder.decode(packet).length, pcm.length);

  const sodium = requireApp('sodium-native');
  const key = Buffer.alloc(sodium.crypto_secretbox_KEYBYTES);
  const nonce = Buffer.alloc(sodium.crypto_secretbox_NONCEBYTES);
  sodium.randombytes_buf(key);
  sodium.randombytes_buf(nonce);
  const message = Buffer.from('SumireVox runtime check');
  const encrypted = Buffer.alloc(message.length + sodium.crypto_secretbox_MACBYTES);
  sodium.crypto_secretbox_easy(encrypted, message, nonce, key);
  const decrypted = Buffer.alloc(message.length);
  assert.equal(sodium.crypto_secretbox_open_easy(decrypted, encrypted, nonce, key), true);
  assert.deepEqual(decrypted, message);
} else {
  const { Hono } = requireApp('hono');
  const { serve } = requireApp('@hono/node-server');
  const healthApp = new Hono();
  healthApp.get('/health', (context) => context.json({ status: 'ok' }));
  const server = serve({ fetch: healthApp.fetch, hostname: '127.0.0.1', port: 0 });
  try {
    if (!server.listening) {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
    }
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

process.stdout.write(`${app}: Node.js ${process.versions.node}, Prisma and runtime checks passed\n`);
