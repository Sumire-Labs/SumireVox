import { PrismaPg } from '@prisma/adapter-pg';
import { databaseConnectionConfig } from '@sumirevox/shared';
import { config } from './config.js';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

let prisma: PrismaClient;

export function getPrisma(): PrismaClient {
  if (!prisma) {
    const connection = databaseConnectionConfig(config.databaseUrl);
    prisma = new PrismaClient({
      adapter: new PrismaPg(connection.pool, { schema: connection.schema }),
      log: [
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    logger.info('Prisma disconnected');
  }
}
