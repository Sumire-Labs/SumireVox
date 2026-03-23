import pino from 'pino';

const level = process.env['LOG_LEVEL'] ?? 'info';

const transport =
  process.env['NODE_ENV'] === 'development'
    ? { target: 'pino-pretty' }
    : undefined;

export const logger: pino.Logger = pino({ level, transport });
