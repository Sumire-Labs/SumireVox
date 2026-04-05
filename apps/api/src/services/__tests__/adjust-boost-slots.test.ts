import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adjustBoostSlots } from '../adjust-boost-slots.js';

const { loggerMock, txMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
  },
  txMock: {
    boost: {
      deleteMany: vi.fn(),
    },
    boostRevocation: {
      createMany: vi.fn(),
    },
  },
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

describe('adjustBoostSlots', () => {
  beforeEach(() => {
    loggerMock.info.mockReset();
    txMock.boost.deleteMany.mockReset();
    txMock.boostRevocation.createMany.mockReset();
  });

  it('deletes unassigned boosts first when targetCount is lower', async () => {
    const boosts = [
      { id: 'boost-1', guildId: null, assignedAt: null },
      { id: 'boost-2', guildId: null, assignedAt: null },
      { id: 'boost-3', guildId: 'guild-1', assignedAt: new Date('2026-01-03T00:00:00.000Z') },
    ];

    await adjustBoostSlots(txMock as never, 'sub-1', 1, boosts);

    expect(txMock.boost.deleteMany).toHaveBeenCalledTimes(1);
    expect(txMock.boostRevocation.createMany).not.toHaveBeenCalled();
    expect(txMock.boost.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['boost-1', 'boost-2'] } },
    });
    expect(loggerMock.info).not.toHaveBeenCalled();
  });

  it('force-removes oldest assigned boosts after unassigned boosts are exhausted', async () => {
    const boosts = [
      { id: 'boost-1', guildId: null, assignedAt: null },
      { id: 'boost-2', guildId: 'guild-newer', assignedAt: new Date('2026-01-03T00:00:00.000Z') },
      { id: 'boost-3', guildId: 'guild-oldest', assignedAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'boost-4', guildId: 'guild-middle', assignedAt: new Date('2026-01-02T00:00:00.000Z') },
    ];

    await adjustBoostSlots(txMock as never, 'sub-1', 1, boosts);

    expect(txMock.boost.deleteMany).toHaveBeenCalledTimes(2);
    expect(txMock.boost.deleteMany).toHaveBeenNthCalledWith(1, {
      where: { id: { in: ['boost-1'] } },
    });
    expect(txMock.boost.deleteMany).toHaveBeenNthCalledWith(2, {
      where: { id: { in: ['boost-3', 'boost-4'] } },
    });
    expect(txMock.boostRevocation.createMany).toHaveBeenCalledWith({
      data: [
        {
          boostId: 'boost-3',
          subscriptionId: 'sub-1',
          guildId: 'guild-oldest',
          assignedAt: new Date('2026-01-01T00:00:00.000Z'),
          revokedAt: expect.any(Date),
          reason: 'SUBSCRIPTION_QUANTITY_DECREASE',
        },
        {
          boostId: 'boost-4',
          subscriptionId: 'sub-1',
          guildId: 'guild-middle',
          assignedAt: new Date('2026-01-02T00:00:00.000Z'),
          revokedAt: expect.any(Date),
          reason: 'SUBSCRIPTION_QUANTITY_DECREASE',
        },
      ],
    });
    expect(loggerMock.info).toHaveBeenCalledTimes(2);
    expect(loggerMock.info).toHaveBeenNthCalledWith(
      1,
      { subscriptionId: 'sub-1', guildId: 'guild-oldest', count: 1 },
      'Boost slots force-unassigned due to subscription quantity decrease',
    );
    expect(loggerMock.info).toHaveBeenNthCalledWith(
      2,
      { subscriptionId: 'sub-1', guildId: 'guild-middle', count: 1 },
      'Boost slots force-unassigned due to subscription quantity decrease',
    );
  });

  it('does nothing when targetCount is greater than or equal to current count', async () => {
    const boosts = [
      { id: 'boost-1', guildId: null, assignedAt: null },
      { id: 'boost-2', guildId: 'guild-1', assignedAt: new Date('2026-01-01T00:00:00.000Z') },
    ];

    await adjustBoostSlots(txMock as never, 'sub-1', 2, boosts);
    await adjustBoostSlots(txMock as never, 'sub-1', 3, boosts);

    expect(txMock.boost.deleteMany).not.toHaveBeenCalled();
    expect(loggerMock.info).not.toHaveBeenCalled();
  });
});
