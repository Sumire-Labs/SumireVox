/** Translate Prisma 6 URL options before passing the connection to node-postgres. */
export function databaseConnectionConfig(connectionString: string) {
  const url = new URL(connectionString);
  const schema = url.searchParams.get('schema') ?? 'public';
  const readInteger = (name: string, fallback: number, minimum = 0): number => {
    const raw = url.searchParams.get(name);
    url.searchParams.delete(name);
    if (raw === null) return fallback;
    const value = Number(raw);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < minimum) {
      throw new RangeError(`Invalid PostgreSQL option: ${name}`);
    }
    return value;
  };

  const max = readInteger('connection_limit', 10, 1);
  const connectTimeout = readInteger('connect_timeout', 5);
  // pg uses one timeout for opening a connection and waiting for a pool slot.
  const connectionTimeoutMillis = readInteger('pool_timeout', connectTimeout) * 1000;
  const idleTimeoutMillis = readInteger('max_idle_connection_lifetime', 300) * 1000;
  const maxLifetimeSeconds = readInteger('max_connection_lifetime', 0);
  url.searchParams.delete('schema');

  return {
    pool: { connectionString: url.toString(), max, connectionTimeoutMillis, idleTimeoutMillis, maxLifetimeSeconds },
    schema,
  };
}
