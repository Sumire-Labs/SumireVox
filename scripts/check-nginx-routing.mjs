import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

// Run from the repository root. Never load production Compose files or credentials.
const images = { nginx: 'nginx:alpine', fixture: 'node:24.22.1-slim' };
function docker(...args) {
  return execFileSync('docker', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000,
  }).trim();
}
for (const image of Object.values(images)) {
  try {
    docker('image', 'inspect', image);
  } catch {
    docker('pull', image);
  }
}

const fixture = `
const { createServer } = require('node:http');
const [port, identity] = process.argv.slice(1);
createServer(async (request, response) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const result = new URL(request.url, 'http://fixture').pathname.endsWith('/health')
    ? { status: 'ok' }
    : { identity, method: request.method, url: request.url,
        host: request.headers.host, signature: request.headers['stripe-signature'],
        body: Buffer.concat(chunks).toString('hex') };
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('X-Fixture-Identity', identity);
  response.end(JSON.stringify(result));
}).listen(Number(port), '0.0.0.0');
`;

for (const production of [false, true]) {
  const name = production ? 'production' : 'standard';
  const prefix = `sumirevox-nginx-check-${name}-${randomUUID().slice(0, 8)}`;
  const network = `${prefix}-network`;
  const nginx = `${prefix}-nginx`;
  const containers = new Set();
  let networkCreated = false;
  try {
    const config = resolve(production ? 'nginx/nginx.prod.conf' : 'nginx/nginx.conf');
    assert.ok(existsSync(config), 'Run this check from the repository root');
    docker('network', 'create', network);
    networkCreated = true;
    const startFixture = (suffix, aliases, port) => {
      const container = `${prefix}-${suffix}`;
      containers.add(container);
      docker('run', '-d', '--name', container, '--network', network,
        ...aliases.flatMap((alias) => ['--network-alias', alias]),
        images.fixture, 'node', '-e', fixture, String(port), suffix);
      return container;
    };
    const firstApi = startFixture('api-before', ['api'], 3000);
    const [first] = JSON.parse(docker('inspect', firstApi));
    const firstAddress = first.NetworkSettings.Networks[network].IPAddress;
    assert.ok(firstAddress, 'The original API must have an IPv4 address');
    if (!production) startFixture('frontend', ['web', 'admin'], 80);
    const mountTarget = production ? '/etc/nginx/nginx.conf' : '/etc/nginx/conf.d/default.conf';
    containers.add(nginx);
    docker('run', '-d', '--name', nginx, '--network', network,
      '-p', '127.0.0.1::80', '--mount', `type=bind,src=${config},dst=${mountTarget},readonly`, images.nginx);
    docker('exec', nginx, 'nginx', '-t');
    const [initial] = JSON.parse(docker('inspect', nginx));
    const port = initial.NetworkSettings.Ports['80/tcp'][0].HostPort;
    const origin = `http://127.0.0.1:${port}`;
    const host = production ? 'api.sumirevox.com' : 'sumirevox.com';
    const healthPath = production ? '/health' : '/api/health';
    async function request(path, options = {}, requestHost = host) {
      // node:http preserves the explicit Host header needed to exercise both virtual hosts.
      const response = await new Promise((resolve, reject) => {
        const call = httpRequest(`${origin}${path}`, {
          method: options.method ?? 'GET', signal: AbortSignal.timeout(1_000),
          headers: {
            ...options.headers, Host: requestHost,
            ...(options.body ? { 'Content-Length': options.body.length } : {}),
          },
        }, (incoming) => {
          const chunks = [];
          incoming.on('data', (chunk) => chunks.push(chunk));
          incoming.on('error', reject);
          incoming.on('end', () => resolve({
            status: incoming.statusCode, identity: incoming.headers['x-fixture-identity'],
            body: Buffer.concat(chunks).toString(),
          }));
        });
        call.on('error', reject);
        call.end(options.body);
      });
      assert.equal(response.status, 200, `${name}: ${path} returned ${response.status}`);
      return { identity: response.identity, data: JSON.parse(response.body) };
    }
    async function waitForHealth(identity, deadline) {
      let lastError;
      while (Date.now() < deadline) {
        try {
          const result = await request(healthPath);
          assert.equal(result.identity, identity);
          assert.deepEqual(result.data, { status: 'ok' });
          assert.ok(Date.now() <= deadline, `${name}: API recovery exceeded 30 seconds`);
          return;
        } catch (error) {
          lastError = error;
          await delay(250);
        }
      }
      throw new Error(`${name}: API did not recover within 30 seconds`, { cause: lastError });
    }
    async function checkApi(identity, requestHost = host) {
      for (const path of [
        '/api/check/a%2Fb?value=%E3%81%99%E3%81%BF%E3%82%8C&value=two%20words&empty=',
        '/auth/callback?code=a%2Bb&state=x%2Fy',
      ]) {
        const result = await request(path, {}, requestHost);
        assert.deepEqual(result.data, { identity, method: 'GET', url: path, host: requestHost, body: '' });
      }
      const body = Buffer.from('{\n "message": "すみれ", "value": 1\n}\n');
      const path = '/api/stripe/webhook?source=check%2Ftest';
      const signature = 't=1234567890,v1=fixture-signature';
      const result = await request(path, {
        method: 'POST', body, headers: { 'Content-Type': 'application/json', 'Stripe-Signature': signature },
      }, requestHost);
      assert.deepEqual(result.data, {
        identity, method: 'POST', url: path, host: requestHost, signature, body: body.toString('hex'),
      });
    }
    await waitForHealth('api-before', Date.now() + 30_000);
    await checkApi('api-before');
    if (!production) {
      await checkApi('api-before', 'admin.sumirevox.com');
      for (const frontendHost of ['sumirevox.com', 'admin.sumirevox.com']) {
        const result = await request('/dashboard?tab=test%2Fvalue', {}, frontendHost);
        assert.deepEqual(result.data, {
          identity: 'frontend', method: 'GET', url: '/dashboard?tab=test%2Fvalue', host: frontendHost, body: '',
        });
      }
    }
    // Reserve the original IP until Docker allocates a different one to the replacement.
    // No requests are sent while both containers share the api alias.
    const secondApi = startFixture('api-after', ['api'], 3000);
    const [second] = JSON.parse(docker('inspect', secondApi));
    const secondAddress = second.NetworkSettings.Networks[network].IPAddress;
    assert.ok(secondAddress, 'The replacement API must have an IPv4 address');
    assert.notEqual(secondAddress, firstAddress, 'The replacement API must use a different IP');
    const deadline = Date.now() + 30_000;
    docker('rm', '-f', firstApi);
    containers.delete(firstApi);
    // Keep the same Nginx process: no restart or reload is allowed during this check.
    await waitForHealth('api-after', deadline);
    await checkApi('api-after');
    if (!production) await checkApi('api-after', 'admin.sumirevox.com');
    const [after] = JSON.parse(docker('inspect', nginx));
    assert.equal(after.State.StartedAt, initial.State.StartedAt);
    assert.equal(after.RestartCount, initial.RestartCount);
    process.stdout.write(`${name}: Nginx routing, webhook bytes and API IP change checks passed\n`);
  } finally {
    const cleanupErrors = [];
    for (const container of containers) {
      try { docker('rm', '-f', container); } catch (error) { cleanupErrors.push(error); }
    }
    if (networkCreated) {
      try { docker('network', 'rm', network); } catch (error) { cleanupErrors.push(error); }
    }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, `Cleanup failed for ${prefix}`);
  }
}
