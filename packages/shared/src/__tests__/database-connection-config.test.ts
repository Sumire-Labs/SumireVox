import { describe, expect, it } from 'vitest';
import { databaseConnectionConfig } from '../database-connection-config.js';

describe('databaseConnectionConfig', () => {
  it('preserves deployed connection limits and PostgreSQL schema', () => {
    const result = databaseConnectionConfig('postgresql://user:password@localhost/db?connection_limit=3&schema=tenant&connect_timeout=7');
    expect(result).toEqual({
      pool: {
        connectionString: 'postgresql://user:password@localhost/db',
        max: 3,
        connectionTimeoutMillis: 10000,
        Client: expect.any(Function),
        idleTimeoutMillis: 300000,
        maxLifetimeSeconds: 0,
      },
      schema: 'tenant',
    });
  });

  it('preserves SSL parameters and translates pool timeouts and lifetime', () => {
    const result = databaseConnectionConfig('postgres://localhost/db?sslmode=require&pool_timeout=0&max_idle_connection_lifetime=12&max_connection_lifetime=60');
    expect(result.pool).toMatchObject({ max: 10, connectionTimeoutMillis: 0, idleTimeoutMillis: 12000, maxLifetimeSeconds: 60 });
    expect(result.pool.connectionString).toContain('sslmode=require');
    expect(result.schema).toBe('public');
  });

  it('preserves schema and all TLS URL options alongside independent timeouts', () => {
    const result = databaseConnectionConfig('postgresql://user:password@localhost/db?schema=tenant&connection_limit=5&connect_timeout=7&pool_timeout=12&sslmode=verify-full&sslcert=%2Ftmp%2Fclient.crt&sslkey=%2Ftmp%2Fclient.key&sslrootcert=%2Ftmp%2Fca.crt');
    const params = new URL(result.pool.connectionString!).searchParams;
    expect(result.schema).toBe('tenant');
    expect(result.pool.max).toBe(5);
    expect(Object.fromEntries(params)).toEqual({ sslmode: 'verify-full', sslcert: '/tmp/client.crt',
      sslkey: '/tmp/client.key', sslrootcert: '/tmp/ca.crt' });
  });

  it.each(['0', '-1', 'oops', '1.5', ''])('rejects invalid connection limits: %s', (limit) => {
    expect(() => databaseConnectionConfig(`postgres://localhost/db?connection_limit=${limit}`)).toThrow();
  });

  it('rejects negative timeouts without exposing credentials', () => {
    expect(() => databaseConnectionConfig('postgres://user:secret@localhost/db?pool_timeout=-1')).toThrow('Invalid PostgreSQL option: pool_timeout');
  });
});

describe('independent database timeouts', () => {
  it.each([
    ['', 10000],
    ['connect_timeout=7', 10000],
    ['pool_timeout=12', 12000],
    ['connect_timeout=7&pool_timeout=12', 12000],
    ['connect_timeout=0', 10000],
    ['pool_timeout=0', 0],
    ['connect_timeout=0&pool_timeout=0', 0],
  ])('keeps the pool wait independent for %s', (query, poolMillis) => {
    expect(databaseConnectionConfig(`postgres://localhost/db?${query}`).pool.connectionTimeoutMillis).toBe(poolMillis);
  });

  it.each(['connect_timeout', 'pool_timeout'])('rejects invalid %s without credentials', (name) => {
    for (const value of ['', '-1', '1.5', 'abc', 'Infinity', 'NaN', '9007199254740992', '2147484']) {
      try {
        databaseConnectionConfig(`postgres://private-user:private-password@localhost/db?${name}=${value}`);
        expect.fail(`accepted ${name}=${value}`);
      } catch (error) {
        expect(error).toBeInstanceOf(RangeError);
        expect(String(error)).toBe(`RangeError: Invalid PostgreSQL option: ${name}`);
        expect(JSON.stringify(error)).not.toMatch(/private-user|private-password/);
      }
    }
  });

  it('sanitizes malformed URL errors', () => {
    try {
      databaseConnectionConfig('postgres://private-user:private-password@[invalid/db');
      expect.fail('accepted malformed URL');
    } catch (error) {
      expect(String(error)).toBe('RangeError: Invalid PostgreSQL connection URL');
      expect(JSON.stringify(error)).not.toMatch(/private-user|private-password/);
    }
  });
});
