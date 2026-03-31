import pino from 'pino';

interface CreateLoggerOptions {
  level?: string;
}

export function createLogger(options?: CreateLoggerOptions): pino.Logger {
  const level = options?.level ?? process.env['LOG_LEVEL'] ?? 'info';
  const transport =
    process.env['NODE_ENV'] === 'development'
      ? { target: 'pino-pretty' }
      : undefined;

  return pino({ level, transport });
}
