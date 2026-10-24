import { Client, type ClientConfig, type PoolConfig } from 'pg';

/** Translate Prisma 6 URL options before passing the connection to node-postgres. */
export function databaseConnectionConfig(connectionString: string): { pool: PoolConfig; schema: string } {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new RangeError('Invalid PostgreSQL connection URL');
  }
  const schema = url.searchParams.get('schema') ?? 'public';
  const readInteger = (name: string, fallback: number, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number => {
    const raw = url.searchParams.get(name);
    url.searchParams.delete(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(`Invalid PostgreSQL option: ${name}`);
    }
    return value;
  };

  const max = readInteger('connection_limit', 10, 1);
  // Node timers above this limit wrap to 1ms; reject rather than silently shorten.
  const maxSeconds = Math.floor(2_147_483_647 / 1000);
  const connectTimeoutMillis = readInteger('connect_timeout', 5, 0, maxSeconds) * 1000;
  const connectionTimeoutMillis = readInteger('pool_timeout', 10, 0, maxSeconds) * 1000;
  const idleTimeoutMillis = readInteger('max_idle_connection_lifetime', 300, 0, maxSeconds) * 1000;
  const maxLifetimeSeconds = readInteger('max_connection_lifetime', 0, 0, maxSeconds);
  // Pool's timer also caps new connections; the Client timer can shorten that cap.
  // Keeping a separate Client timer preserves connect=5 / pool=10 defaults.
  class DatabaseClient extends Client {
    constructor(config?: ClientConfig) {
      super({ ...config, connectionTimeoutMillis: connectTimeoutMillis });
    }
  }
  url.searchParams.delete('schema');

  return {
    pool: { Client: DatabaseClient, connectionString: url.toString(), max, connectionTimeoutMillis, idleTimeoutMillis, maxLifetimeSeconds },
    schema,
  };
}
