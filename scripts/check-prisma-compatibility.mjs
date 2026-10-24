import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';

// This check can only use a dedicated, local test database; never load .env.
const databaseUrl = new URL(process.env.TEST_DATABASE_URL ?? '');
assert.ok(['127.0.0.1', 'localhost'].includes(databaseUrl.hostname), 'A local test database is required');
assert.equal(databaseUrl.pathname, '/sumirevox_upgrade_test', 'Use the dedicated sumirevox_upgrade_test database');
const schema = `upgrade_${randomUUID().replaceAll('-', '')}`;
databaseUrl.searchParams.set('schema', schema);
databaseUrl.searchParams.set('connection_limit', '2');
const requireBot = createRequire(resolve('apps/bot/package.json'));
const requireApi = createRequire(resolve('apps/api/package.json'));
const { PrismaClient, Prisma } = requireBot('@prisma/client');
assert.equal(requireApi('@prisma/client').PrismaClient, PrismaClient, 'Bot and API must share the generated client');
const { PrismaPg } = requireBot('@prisma/adapter-pg');
const { databaseConnectionConfig } = requireBot('@sumirevox/shared');
const connection = databaseConnectionConfig(databaseUrl.toString());
const bot = new PrismaClient({ adapter: new PrismaPg(connection.pool, { schema }) });
const api = new PrismaClient({ adapter: new PrismaPg(connection.pool, { schema }) });

// The same driver version used by shared's configured Client and PrismaPg.
const { Pool } = createRequire(resolve('packages/shared/package.json'))('pg');
const timeoutUrl = (connectSeconds, poolSeconds, source = databaseUrl) => {
  const url = new URL(source);
  url.searchParams.set('connection_limit', '1');
  if (connectSeconds === undefined) url.searchParams.delete('connect_timeout');
  else url.searchParams.set('connect_timeout', String(connectSeconds));
  if (poolSeconds === undefined) url.searchParams.delete('pool_timeout');
  else url.searchParams.set('pool_timeout', String(poolSeconds));
  return url.toString();
};

async function bounded(promise, milliseconds = 15000) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Compatibility check exceeded its deadline')), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkPoolTimeouts() {
  // Connection establishment has a longer limit than the queue timeout.
  const pool = new Pool(databaseConnectionConfig(timeoutUrl(3, 1)).pool);
  let held;
  try {
    held = await pool.connect();
    const start = performance.now();
    await assert.rejects(bounded(pool.connect()), /timeout exceeded when trying to connect/);
    assert.ok(performance.now() - start >= 700, 'Pool wait must not fail immediately');
    assert.equal(pool.waitingCount, 0, 'Timed-out waiter must leave the queue');
    held.release();
    held = null;
    const next = await pool.connect();
    next.release();
  } finally {
    held?.release();
    await pool.end();
  }

  // An omitted pool_timeout must stay at 10s even with connect_timeout=1.
  const defaults = new Pool(databaseConnectionConfig(timeoutUrl(1, undefined)).pool);
  let defaultHeld;
  try {
    defaultHeld = await defaults.connect();
    const start = performance.now();
    await assert.rejects(bounded(defaults.connect()), /timeout exceeded when trying to connect/);
    const elapsed = performance.now() - start;
    assert.ok(elapsed >= 9700 && elapsed < 14000, `Default pool wait must be 10s, elapsed=${elapsed}`);
  } finally {
    defaultHeld?.release();
    await defaults.end();
  }

  // pool_timeout=0 must not inherit connect_timeout=1.
  const unlimited = new Pool(databaseConnectionConfig(timeoutUrl(1, 0)).pool);
  let first;
  try {
    first = await unlimited.connect();
    const waiting = unlimited.connect();
    void waiting.catch(() => {});
    await delay(1200);
    assert.equal(unlimited.waitingCount, 1, 'Queue wait remains unlimited after connect timeout');
    first.release();
    first = null;
    (await waiting).release();
    assert.equal(unlimited.waitingCount, 0);
  } finally {
    first?.release();
    await unlimited.end();
  }

  // Confirm that PrismaPg actually uses the configured pg Client/Pool as well.
  const config = databaseConnectionConfig(timeoutUrl(3, 1));
  const prisma = new PrismaClient({ adapter: new PrismaPg(config.pool, { schema }) });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1`;
      await assert.rejects(prisma.$queryRaw`SELECT 1`, /timeout|connection/i);
      await tx.$queryRaw`SELECT 1`;
    }, { timeout: 10000 });
    await prisma.$queryRaw`SELECT 1`;
  } finally {
    await prisma.$disconnect();
  }
}

async function checkConnectionTimeouts() {
  // Accept TCP but never complete PostgreSQL authentication: no external network.
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const stalledUrl = new URL('postgresql://timeout-test@127.0.0.1/sumirevox_upgrade_test');
  stalledUrl.port = String(address.port);
  try {
    for (const [connect, poolTimeout] of [[1, 3], [3, 1], [1, 0], [0, 1], [1, undefined], [undefined, 1], [undefined, undefined]]) {
      const pool = new Pool(databaseConnectionConfig(timeoutUrl(connect, poolTimeout, stalledUrl)).pool);
      try {
        const start = performance.now();
        await assert.rejects(bounded(pool.connect()), /timeout|terminated/i);
        const elapsed = performance.now() - start;
        const expected = Math.min(...[connect ?? 5, poolTimeout ?? 10].filter((seconds) => seconds > 0)) * 1000;
        assert.ok(elapsed >= expected - 300 && elapsed < expected + 1800,
          `connect=${connect}/pool=${poolTimeout} must honor ${expected}ms, elapsed=${elapsed}`);
        assert.equal(pool.totalCount, 0, 'Failed connection must not leak a pool slot');
      } finally {
        for (const socket of sockets) socket.destroy();
        await pool.end();
      }
    }
    // Test the Prisma adapter path against the same stalled handshake.
    const config = databaseConnectionConfig(timeoutUrl(1, 3, stalledUrl));
    const prisma = new PrismaClient({ adapter: new PrismaPg(config.pool) });
    try {
      await assert.rejects(prisma.$queryRaw`SELECT 1`, /timeout|terminated|connection/i);
    } finally {
      await prisma.$disconnect();
    }
    const pool = new Pool(databaseConnectionConfig(timeoutUrl(0, 0, stalledUrl)).pool);
    try {
      let settled = false;
      const pending = pool.connect().then(
        (client) => { client.release(); settled = true; },
        () => { settled = true; },
      );
      await delay(150);
      assert.equal(settled, false, 'Both timers disabled must keep the handshake pending');
      for (const socket of sockets) socket.destroy();
      await bounded(pending);
    } finally {
      for (const socket of sockets) socket.destroy();
      await pool.end();
    }
  } finally {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

try {
  execFileSync(process.execPath, [
    requireBot.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--config=apps/bot/prisma.config.ts',
  ], { env: { ...process.env, DATABASE_URL: databaseUrl.toString() }, stdio: 'pipe' });
  // Deploy twice: existing migration history must remain valid and idempotent.
  execFileSync(process.execPath, [
    requireBot.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--config=apps/bot/prisma.config.ts',
  ], { env: { ...process.env, DATABASE_URL: databaseUrl.toString() }, stdio: 'pipe' });

  const settings = { '1': { autoJoin: true, channelId: '123456789' } };
  await bot.guildSettings.create({ data: { guildId: 'test-guild', botInstanceSettings: settings } });
  assert.deepEqual((await api.guildSettings.findUniqueOrThrow({ where: { guildId: 'test-guild' } })).botInstanceSettings, settings);
  await assert.rejects(bot.guildSettings.create({ data: { guildId: 'test-guild' } }),
    (error) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002');
  await assert.rejects(api.guildSettings.update({ where: { guildId: 'missing' }, data: { manualPremium: true } }),
    (error) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025');

  const periodEnd = new Date('2027-01-15T08:00:00.000Z');
  await api.$transaction(async (tx) => {
    const isolation = await tx.$queryRaw`SHOW transaction_isolation`;
    assert.equal(isolation[0].transaction_isolation, 'serializable');
    await tx.subscription.create({ data: {
      userId: 'test-user', stripeCustomerId: 'cus_test', stripeSubscriptionId: 'sub_test',
      status: 'ACTIVE', boostCount: 1, currentPeriodEnd: periodEnd,
      boosts: { create: { guildId: 'test-guild' } },
    } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const boost = await bot.boost.findFirstOrThrow({ include: { subscription: true, guild: true } });
  assert.equal(boost.guild.guildId, 'test-guild');
  assert.equal(boost.subscription.currentPeriodEnd.getTime(), periodEnd.getTime());

  let readers = 0;
  let releaseReaders;
  const bothRead = new Promise((resolve) => { releaseReaders = resolve; });
  const increment = (client) => client.$transaction(async (tx) => {
    const guild = await tx.guildSettings.findUniqueOrThrow({ where: { guildId: 'test-guild' } });
    if (++readers === 2) releaseReaders();
    await bothRead;
    await tx.guildSettings.update({ where: { guildId: 'test-guild' }, data: { maxReadLength: guild.maxReadLength + 1 } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  const conflicts = await Promise.allSettled([increment(bot), increment(api)]);
  assert.equal(conflicts.filter((result) => result.status === 'fulfilled').length, 1);
  const conflict = conflicts.find((result) => result.status === 'rejected');
  assert.ok(conflict.reason instanceof Prisma.PrismaClientKnownRequestError);
  assert.equal(conflict.reason.code, 'P2034');
  assert.equal((await bot.guildSettings.findUniqueOrThrow({ where: { guildId: 'test-guild' } })).maxReadLength, 51);

  const rollback = new Error('intentional transaction rollback');
  await assert.rejects(api.$transaction(async (tx) => {
    await tx.guildSettings.create({ data: { guildId: 'rolled-back' } });
    throw rollback;
  }), (error) => error === rollback);
  assert.equal(await bot.guildSettings.count({ where: { guildId: 'rolled-back' } }), 0);
  await api.stripeEvent.create({ data: { id: 'evt_test', type: 'invoice.paid', payload: { data: { object: { id: 'in_test' } } } } });
  assert.deepEqual((await bot.stripeEvent.findUniqueOrThrow({ where: { id: 'evt_test' } })).payload, { data: { object: { id: 'in_test' } } });
  await checkPoolTimeouts();
  await checkConnectionTimeouts();
  process.stdout.write('pg/PrismaPg: pool exhaustion, independent timeouts, disabled timers, stalled handshake and recovery passed\n');
  process.stdout.write('Prisma: existing migrations, shared client, JSON, dates, relations, P2002/P2025/P2034, Serializable and rollback passed\n');
} finally {
  // Only the random schema created above is removed, in the dedicated test DB.
  await bot.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await Promise.all([bot.$disconnect(), api.$disconnect()]);
}
