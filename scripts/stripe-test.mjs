import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { parseEnv } from 'node:util';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline';
import { validateStripeTestConfig } from './stripe-test-config.mjs';

const root = resolve(import.meta.dirname, '..');
const state = resolve(root, '.stripe-test');
const envPath = resolve(root, '.env.stripe-test.local');
const tools = resolve(state, 'tools');
const localNode = resolve(tools, 'node_modules/node/bin/node');
const cli = resolve(tools, 'node_modules/.bin/stripe');
const cliArgs = ['--config', resolve(state, 'cli.toml'), '--project-name', 'sumirevox-stripe-test'];
const [command = 'help', argument] = process.argv.slice(2);
const requireBot = createRequire(resolve(root, 'apps/bot/package.json'));
const requireApi = createRequire(resolve(root, 'apps/api/package.json'));
const out = (message) => process.stdout.write(`${message}\n`);
const run = (file, args, env = process.env) => execFileSync(file, args, { cwd: root, env, stdio: 'pipe', timeout: 120000 });
const redact = (text) => String(text).replace(/(?:sk|rk)_(?:test|live)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/g, '[REDACTED]')
  .replace(/(?:postgres(?:ql)?|redis):\/\/[^\s"']+/g, '[接続URL非表示]');
const saveEnv = (config) => {
  writeFileSync(envPath, Object.entries(config).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n') + '\n', { mode: 0o600 });
  chmodSync(envPath, 0o600);
};
const readConfig = (requireStripe = false) => {
  if (!existsSync(envPath)) throw new Error('最初に pnpm stripe:test setup を実行してください');
  const config = parseEnv(readFileSync(envPath, 'utf8'));
  validateStripeTestConfig(config, requireStripe);
  return config;
};
const compose = (args) => run('docker', ['compose', '--env-file', envPath, '-p', 'sumirevox-stripe-test',
  '-f', 'docker-compose.stripe-test.yml', ...args]);
const cliEnv = (config) => ({ ...process.env, STRIPE_API_KEY: config.STRIPE_SECRET_KEY,
  STRIPE_NO_AUTO_UPDATE: '1', STRIPE_CLI_TELEMETRY_OPTOUT: '1' });
const applyConfig = (config) => Object.assign(process.env, config);

// Use the pinned runtime without requiring a change to the user's global Node.
if (existsSync(localNode) && resolve(process.execPath) !== localNode && process.version !== 'v24.22.1') {
  const child = spawn(localNode, [process.argv[1], ...process.argv.slice(2)], {
    cwd: root, stdio: 'inherit', env: { ...process.env, PATH: `${dirname(localNode)}:${process.env.PATH}` },
  });
  child.on('exit', (code) => process.exit(code ?? 1));
} else {
  try { await main(); } catch (error) {
    // Child errors may contain command output; never include environment/credentials.
    out(redact(error.stderr?.toString() || error.message));
    process.exitCode = 1;
  }
}

async function main() {
  if (command === 'setup') {
    mkdirSync(state, { recursive: true, mode: 0o700 });
    chmodSync(state, 0o700);
    if (!existsSync(cli) || !existsSync(localNode)) {
      out('専用のNode.js 24.22.1とStripe CLI 1.55.1をインストールしています…');
      run('npm', ['install', '--prefix', tools, 'node@24.22.1', '@stripe/cli@1.55.1']);
    }
    if (!existsSync(envPath)) {
      const postgresPassword = randomBytes(24).toString('hex');
      const redisPassword = randomBytes(24).toString('hex');
      saveEnv({ NODE_ENV: 'development', LOG_LEVEL: 'info',
        STRIPE_TEST_POSTGRES_PASSWORD: postgresPassword, STRIPE_TEST_REDIS_PASSWORD: redisPassword,
        DATABASE_URL: `postgresql://sumirevox_stripe_test:${postgresPassword}@127.0.0.1:15446/sumirevox_stripe_test?connection_limit=5`,
        REDIS_URL: `redis://:${redisPassword}@127.0.0.1:16446/0`,
        API_PORT: '3146', API_DOMAIN: 'http://127.0.0.1:3146', WEB_DOMAIN: 'http://127.0.0.1:3146',
        ADMIN_DOMAIN: 'http://127.0.0.1:3146', CORS_ORIGIN: 'http://127.0.0.1:3146',
        DISCORD_CLIENT_ID: 'stripe-test-unused', DISCORD_CLIENT_SECRET: 'stripe-test-unused',
        STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '', STRIPE_PRICE_ID: '',
        STRIPE_RECONCILE_INTERVAL_MS: '15000',
      });
    }
    const config = readConfig();
    out('専用PostgreSQL・Redisを起動しています…');
    compose(['up', '-d', '--wait', '--wait-timeout', '90']);
    const env = { ...process.env, ...config, PATH: `${dirname(localNode)}:${process.env.PATH}` };
    run(localNode, [requireBot.resolve('prisma/build/index.js'), 'generate', '--config=apps/bot/prisma.config.ts'], env);
    run(localNode, [requireBot.resolve('prisma/build/index.js'), 'migrate', 'deploy', '--config=apps/bot/prisma.config.ts'], env);
    run('pnpm', ['--filter', '@sumirevox/shared', '--filter', '@sumirevox/api', 'build'], env);
    out('ローカル環境を準備しました。Stripe Sandboxのテストキーを .env.stripe-test.local に設定し、pnpm stripe:test configure を実行してください。');
    return;
  }
  if (command === 'login') {
    await inherit(cli, [...cliArgs, 'login'], { ...process.env, STRIPE_NO_AUTO_UPDATE: '1' });
    return;
  }
  if (command === 'down') { readConfig(); compose(['down']); out('専用コンテナを停止しました。データは保持しています。'); return; }
  if (!['configure', 'listen', 'api', 'checkout', 'status'].includes(command)) {
    out('pnpm stripe:test <setup|login|configure|listen|api|checkout|status|down>'); return;
  }
  const config = readConfig(command !== 'status');
  applyConfig(config);
  if (command === 'configure') {
    const Stripe = requireApi('stripe');
    const stripe = new Stripe(config.STRIPE_SECRET_KEY, { apiVersion: '2026-09-30.endive' });
    const price = config.STRIPE_PRICE_ID
      ? await stripe.prices.retrieve(config.STRIPE_PRICE_ID)
      : await stripe.prices.create({ currency: 'jpy', unit_amount: 300, recurring: { interval: 'month' },
        product_data: { name: 'SumireVox Sandbox Boost' } }, { idempotencyKey: 'sumirevox-local-monthly-300-v1' });
    if (price.livemode || price.currency !== 'jpy' || price.unit_amount !== 300 || price.recurring?.interval !== 'month') {
      throw new Error('Sandboxの月額300円Priceではありません');
    }
    config.STRIPE_PRICE_ID = price.id;
    saveEnv(config);
    const secretOutput = run(cli, [...cliArgs, 'listen', '--print-secret'], cliEnv(config)).toString();
    const secret = secretOutput.match(/\bwhsec_[A-Za-z0-9]+\b/)?.[0];
    if (!secret) throw new Error('Webhook署名secretを取得できませんでした');
    config.STRIPE_WEBHOOK_SECRET = secret;
    saveEnv(config);
    out('SandboxのPriceとWebhook署名設定を保存しました。listenとapiを別ターミナルで起動できます。');
    return;
  }
  if (command === 'listen') {
    if (!config.STRIPE_WEBHOOK_SECRET) throw new Error('先に configure を実行してください');
    await inherit(cli, [...cliArgs, 'listen', '--forward-to', `${config.API_DOMAIN}/api/stripe/webhook`,
      '--events', 'checkout.session.completed,invoice.paid,invoice.payment_failed,customer.subscription.updated,customer.subscription.deleted,charge.refunded'], cliEnv(config), true);
    return;
  }
  if (command === 'api') {
    if (!config.STRIPE_WEBHOOK_SECRET || !config.STRIPE_PRICE_ID) throw new Error('先に configure を実行してください');
    const { createApp } = await import('../apps/api/dist/app.js');
    const { serve } = requireApi('@hono/node-server');
    const { getPrisma, disconnectPrisma } = await import('../apps/api/dist/infrastructure/database.js');
    const { disconnectRedis } = await import('../apps/api/dist/infrastructure/redis.js');
    const { drainStripeEventOutbox } = await import('../apps/api/dist/services/stripe-event-outbox.js');
    const { createStripeSubscriptionReconcileRunner, reconcileStripeSubscriptions } = await import('../apps/api/dist/services/stripe-subscription-reconciler.js');
    const app = createApp();
    app.get('/dashboard/boost', (c) => c.text('Sandbox Checkoutから戻りました。ターミナルで pnpm stripe:test status を実行して結果を確認してください。'));
    await getPrisma().$connect();
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 3146 });
    const reconcile = createStripeSubscriptionReconcileRunner(reconcileStripeSubscriptions);
    const drain = () => drainStripeEventOutbox().catch((error) => out(redact(error.message)));
    void drain();
    const timer = setInterval(() => { void reconcile().catch((error) => out(redact(error.message))); void drain(); }, 15000);
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      clearInterval(timer);
      await new Promise((resolve) => server.close(resolve));
      await disconnectRedis(); await disconnectPrisma(); process.exit(0);
    };
    process.on('SIGINT', close); process.on('SIGTERM', close);
    out('StripeテストAPI: http://127.0.0.1:3146/health');
    return;
  }
  if (command === 'checkout') {
    const userId = argument ?? '900000000000000046';
    if (!/^\d{17,20}$/.test(userId)) throw new Error('テスト用ユーザーIDは17〜20桁の数字にしてください');
    const { createSession, deleteSession } = await import('../apps/api/dist/infrastructure/session.js');
    const { disconnectRedis } = await import('../apps/api/dist/infrastructure/redis.js');
    let sessionId;
    try {
      sessionId = await createSession({ userId, username: 'Stripe Sandbox Tester', discriminator: '0', avatar: null,
        accessToken: 'unused-local-test-session', refreshToken: 'unused-local-test-session', tokenExpiresAt: Date.now() + 600000 });
      const response = await fetch(`${config.API_DOMAIN}/api/user/boosts/checkout`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `session_id=${sessionId}` },
        body: JSON.stringify({ boostCount: 1 }), signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? 'Checkoutを作成できませんでした');
      const url = new URL(result.data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Stripe Checkout以外のURLが返されました');
      out(`ブラウザーで開いてください（テスト用ユーザー ${userId}）:\n${url}`);
    } finally {
      if (sessionId) await deleteSession(sessionId);
      await disconnectRedis();
    }
    return;
  }
  const { getPrisma, disconnectPrisma } = await import('../apps/api/dist/infrastructure/database.js');
  try {
    const subscriptions = await getPrisma().subscription.findMany({ include: { boosts: true }, orderBy: { createdAt: 'desc' }, take: 20 });
    const events = await getPrisma().stripeEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 20,
      select: { id: true, type: true, status: true, attempts: true, lastError: true } });
    out(redact(JSON.stringify({ subscriptions, events }, null, 2)));
  } finally { await disconnectPrisma(); }
}

async function inherit(file, args, env, mask = false) {
  await new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd: root, env, stdio: mask ? ['inherit', 'pipe', 'pipe'] : 'inherit' });
    if (mask) {
      for (const stream of [child.stdout, child.stderr]) {
        createInterface({ input: stream }).on('line', (line) => out(redact(line)));
      }
    }
    child.on('error', reject);
    child.on('exit', (code, signal) => code === 0 || signal === 'SIGINT' ? resolve() : reject(new Error('コマンドが失敗しました')));
  });
}
