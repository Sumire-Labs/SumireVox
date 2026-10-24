import { describe, expect, it } from 'vitest';
import { databaseConnectionConfig } from '../database-connection-config.js';

describe('databaseConnectionConfig', () => {
  it('preserves deployed connection limits and PostgreSQL schema', () => {
    const result = databaseConnectionConfig('postgresql://user:password@localhost/db?connection_limit=3&schema=tenant&connect_timeout=7');
    expect(result).toEqual({
      pool: {
        connectionString: 'postgresql://user:password@localhost/db',
        max: 3,
        connectionTimeoutMillis: 7000,
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

  it.each(['0', '-1', 'oops', '1.5', ''])('rejects invalid connection limits: %s', (limit) => {
    expect(() => databaseConnectionConfig(`postgres://localhost/db?connection_limit=${limit}`)).toThrow();
  });

  it('rejects negative timeouts without exposing credentials', () => {
    expect(() => databaseConnectionConfig('postgres://user:secret@localhost/db?pool_timeout=-1')).toThrow('Invalid PostgreSQL option: pool_timeout');
  });
});
