/** Keep development tooling from touching production services or accepting live keys. */
export function validateStripeTestConfig(config, requireStripe = false) {
  const reject = (name) => { throw new Error(`Stripeテスト環境の設定が不正です: ${name}`); };
  if (config.NODE_ENV !== 'development') reject('NODE_ENV');
  for (const [name, protocol, port, database] of [
    ['DATABASE_URL', 'postgresql:', '15446', '/sumirevox_stripe_test'],
    ['REDIS_URL', 'redis:', '16446', '/0'],
  ]) {
    let url;
    try { url = new URL(config[name]); } catch { reject(name); }
    if (url.protocol !== protocol || url.hostname !== '127.0.0.1' || url.port !== port || url.pathname !== database) reject(name);
    // pg also accepts routing overrides in query parameters.
    const allowed = name === 'DATABASE_URL' ? ['connection_limit', 'connect_timeout', 'pool_timeout'] : [];
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key))) reject(name);
  }
  if (config.API_PORT !== '3146') reject('API_PORT');
  for (const name of ['API_DOMAIN', 'WEB_DOMAIN']) {
    if (config[name] !== 'http://127.0.0.1:3146') reject(name);
  }
  const key = config.STRIPE_SECRET_KEY ?? '';
  if ((key || requireStripe) && !/^(sk|rk)_test_\w+$/.test(key)) reject('STRIPE_SECRET_KEY（Sandboxのテストキーを設定してください）');
}
