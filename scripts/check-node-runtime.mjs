import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { connect, createSecureServer } from 'node:http2';
import { once } from 'node:events';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const app = process.argv[2];
assert.ok(app === 'bot' || app === 'api', 'Usage: node scripts/check-node-runtime.mjs bot|api');
const [major, minor, patch] = process.versions.node.split('.').map(Number);
assert.ok(major === 24 && (minor > 22 || (minor === 22 && patch >= 1)), 'Node.js >=24.22.1 <25 is required');

const requireApp = createRequire(resolve(`apps/${app}/package.json`));
assert.ok(existsSync(`apps/${app}/dist/index.js`), 'Application entry point is missing');
assert.ok(existsSync('packages/shared/dist/index.js'), 'Shared build is missing');
assert.ok(existsSync('apps/bot/prisma/schema.prisma'), 'Prisma schema is missing');
const { PrismaClient } = requireApp('@prisma/client');
const { PrismaPg } = requireApp('@prisma/adapter-pg');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: 'postgresql://unused:unused@127.0.0.1:1/unused' }),
});
await prisma.$disconnect();

if (app === 'bot') {
  assert.ok(existsSync('apps/bot/dist/bot.js'), 'Shard entry point is missing');
  assert.ok(existsSync('apps/bot/assets'), 'Bot assets are missing');
  const { ShardingManager } = requireApp('discord.js');
  const manager = new ShardingManager(resolve('apps/bot/dist/bot.js'), { totalShards: 1 });
  assert.equal(manager.totalShards, 1);
  requireApp('@discordjs/voice');

  // Exercise the actual Discord REST transport, including TLS/ALPN negotiation.
  const requireDiscord = createRequire(requireApp.resolve('discord.js'));
  const { REST } = requireDiscord('@discordjs/rest');
  const http = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ method: request.method, body: Buffer.concat(chunks).toString() }));
  });
  http.listen(0, '127.0.0.1');
  await once(http, 'listening');
  try {
    const address = http.address();
    assert.ok(address && typeof address !== 'string');
    const rest = new REST({ api: `http://127.0.0.1:${address.port}` });
    assert.deepEqual(await rest.get('/gateway', { auth: false }), { method: 'GET', body: '' });
    const body = { name: 'test-command' };
    assert.deepEqual(await rest.put('/applications/test/commands', { auth: false, body }), {
      method: 'PUT', body: JSON.stringify(body),
    });
  } finally {
    await new Promise((resolve, reject) => http.close((error) => error ? reject(error) : resolve()));
  }

  const requireRest = createRequire(requireDiscord.resolve('@discordjs/rest'));
  const { Agent } = requireRest('undici');
  const tlsDirectory = mkdtempSync(join(tmpdir(), 'sumirevox-rest-'));
  let agent;
  let tlsServer;
  const sockets = new Set();
  try {
    const keyPath = join(tlsDirectory, 'key.pem');
    const certPath = join(tlsDirectory, 'cert.pem');
    execFileSync('openssl', [
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
      '-subj', '/CN=localhost', '-addext', 'subjectAltName=IP:127.0.0.1',
      '-keyout', keyPath, '-out', certPath,
    ], { stdio: 'pipe', timeout: 10_000 });
    const cert = readFileSync(certPath);
    tlsServer = createSecureServer({ key: readFileSync(keyPath), cert, allowHTTP1: true });
    tlsServer.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });
    tlsServer.on('request', async (request, response) => {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      response.setHeader('Content-Type', 'application/json');
      response.setHeader('X-Runtime-Check', 'tls');
      response.end(JSON.stringify({
        method: request.method, body: Buffer.concat(chunks).toString(), version: request.httpVersion,
      }));
    });
    tlsServer.listen(0, '127.0.0.1');
    await once(tlsServer, 'listening');
    const address = tlsServer.address();
    assert.ok(address && typeof address !== 'string');
    const api = `https://127.0.0.1:${address.port}`;
    // Prove the fixture offers h2 before testing the REST client's default protocol.
    const session = connect(api, { ca: cert });
    try {
      await once(session, 'connect');
      assert.equal(session.alpnProtocol, 'h2');
    } finally {
      session.destroy();
    }
    // Do not set allowH2: this must catch incompatible changes to its default.
    agent = new Agent({ connect: { ca: cert } });
    const rest = new REST({ api, agent, retries: 0, timeout: 5_000 });
    const get = await rest.queueRequest({ fullRoute: '/gateway', method: 'GET', auth: false });
    assert.equal(get.headers.get('x-runtime-check'), 'tls');
    assert.deepEqual(await get.json(), { method: 'GET', body: '', version: '1.1' });
    const body = { name: 'test-command' };
    assert.deepEqual(await rest.put('/applications/test/commands', { auth: false, body }), {
      method: 'PUT', body: JSON.stringify(body), version: '1.1',
    });
    assert.equal(requireRest('undici/package.json').version, '6.29.1');
    assert.equal(requireDiscord('undici/package.json').version, '6.29.1');
  } finally {
    await agent?.destroy();
    for (const socket of sockets) socket.destroy();
    if (tlsServer?.listening) {
      await new Promise((resolve, reject) => tlsServer.close((error) => error ? reject(error) : resolve()));
    }
    rmSync(tlsDirectory, { recursive: true, force: true });
  }

  const requireOpus = createRequire(requireApp.resolve('@discordjs/opus'));
  const requirePreGyp = createRequire(requireOpus.resolve('@discordjs/node-pre-gyp'));
  const requireRimraf = createRequire(requirePreGyp.resolve('rimraf'));
  const requireGlob = createRequire(requireRimraf.resolve('glob'));
  const minimatch = requireGlob('minimatch');
  assert.equal(minimatch('audio/first.wav', 'audio/{first,second}.wav'), true);
  assert.equal(minimatch('audio/third.wav', 'audio/{first,second}.wav'), false);

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
