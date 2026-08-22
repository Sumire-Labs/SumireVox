import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, loggerMock, getActiveInstanceCountMock, publishGuildPremiumInvalidationMock } = vi.hoisted(
  () => ({
    prismaMock: {
      boost: {
        groupBy: vi.fn(),
        findMany: vi.fn(),
        updateMany: vi.fn(),
      },
    },
    getActiveInstanceCountMock: vi.fn(),
    publishGuildPremiumInvalidationMock: vi.fn(),
    loggerMock: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  }),
);

vi.mock('../../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../bot-instance-service.js', () => ({
  getActiveInstanceCount: getActiveInstanceCountMock,
}));

vi.mock('../premium-cache-sync.js', () => ({
  publishGuildPremiumInvalidation: publishGuildPremiumInvalidationMock,
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: { boostCooldownDays: 7 },
}));

import { reconcileBoosts } from '../boost-service.js';

describe('reconcileBoosts', () => {
  beforeEach(() => {
    prismaMock.boost.groupBy.mockReset();
    prismaMock.boost.findMany.mockReset();
    prismaMock.boost.updateMany.mockReset();
    getActiveInstanceCountMock.mockReset();
    publishGuildPremiumInvalidationMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
  });

  it('skips reconciliation and does not groupBy when there are no active bot instances', async () => {
    getActiveInstanceCountMock.mockResolvedValue(0);

    await reconcileBoosts();

    expect(prismaMock.boost.groupBy).not.toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith(
      'Boost reconciliation skipped: no active bot instances',
    );
  });
});