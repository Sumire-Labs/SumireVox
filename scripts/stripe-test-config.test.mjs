import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateStripeTestConfig } from './stripe-test-config.mjs';

const config = () => ({
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://sumirevox_stripe_test:local-password@127.0.0.1:15446/sumirevox_stripe_test?connection_limit=5',
  REDIS_URL: 'redis://:local-password@127.0.0.1:16446/0',
  API_PORT: '3146',
  API_DOMAIN: 'http://127.0.0.1:3146',
  WEB_DOMAIN: 'http://127.0.0.1:3146',
  STRIPE_SECRET_KEY: 'sk_test_fixture',
});
test('accepts only the dedicated local test environment', () => {
  assert.doesNotThrow(() => validateStripeTestConfig(config()));
});
for (const [key, value] of [
  ['NODE_ENV', 'production'],
  ['DATABASE_URL', 'postgres://secret:password@prod.example.com:5432/production'],
  ['DATABASE_URL', config().DATABASE_URL + '&host=prod.example.com'],
  ['DATABASE_URL', 'postgresql://private:password@[invalid/db'],
  ['DATABASE_URL', config().DATABASE_URL.replace('15446', '5432')],
  ['DATABASE_URL', config().DATABASE_URL.replace('/sumirevox_stripe_test?', '/sumirevox?')],
  ['REDIS_URL', 'redis://secret:password@prod.example.com/0'],
  ['REDIS_URL', config().REDIS_URL.replace('16446', '6379')],
  ['API_PORT', '3000'],
  ['API_DOMAIN', 'https://api.sumirevox.com'],
  ['WEB_DOMAIN', 'https://sumirevox.com'],
  ['STRIPE_SECRET_KEY', 'sk_live_fixture'],
  ['STRIPE_SECRET_KEY', 'rk_live_fixture'],
  ['STRIPE_SECRET_KEY', 'invalid_fixture'],
]) {
  test(`rejects unsafe ${key}: ${value.split(':')[0]}`, () => {
    assert.throws(() => validateStripeTestConfig({ ...config(), [key]: value }), (error) => {
      assert.ok(!error.message.includes('password'));
      assert.ok(!error.message.includes('sk_live_fixture'));
      return true;
    });
  });
}
test('allows missing Stripe configuration during infrastructure setup', () => {
  assert.doesNotThrow(() => validateStripeTestConfig({ ...config(), STRIPE_SECRET_KEY: '' }));
  assert.throws(() => validateStripeTestConfig({ ...config(), STRIPE_SECRET_KEY: '' }, true));
});
