import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

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
  process.stdout.write('Prisma: existing migrations, shared client, JSON, dates, relations, P2002/P2025/P2034, Serializable and rollback passed\n');
} finally {
  // Only the random schema created above is removed, in the dedicated test DB.
  await bot.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await Promise.all([bot.$disconnect(), api.$disconnect()]);
}
