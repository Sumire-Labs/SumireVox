import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BotInstance } from '@sumirevox/shared';

const { pipelineMock, redisMock, prismaMock, cacheMock, loggerMock } = vi.hoisted(() => ({
  pipelineMock: {
    sismember: vi.fn(),
    exec: vi.fn(),
  },
  redisMock: {
    pipeline: vi.fn(),
    sismember: vi.fn(),
    smembers: vi.fn(),
  },
  prismaMock: {
    botInstance: {
      findMany: vi.fn(),
    },
    guildSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    boost: {
      count: vi.fn(),
    },
  },
  cacheMock: {
    invalidateGuildSettingsCache: vi.fn(),
  },
  loggerMock: {
    info: vi.fn(),
  },
}));

redisMock.pipeline.mockImplementation(() => pipelineMock);

vi.mock('../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('../infrastructure/database.js', () => ({
  getPrisma: vi.fn(() => prismaMock),
}));

vi.mock('../infrastructure/settings-cache.js', () => cacheMock);

vi.mock('../infrastructure/logger.js', () => ({ logger: loggerMock }));

import {
  copyBotInstanceSettings,
  getBotGuildMemberships,
  getCopyableBotInstances,
  getGuildBotList,
  getGuildsWithBotStatus,
  updateGuildBotInstanceSettings,
} from './bot-instance-service.js';

describe('getGuildsWithBotStatus', () => {
  const instances: BotInstance[] = [
    {
      instanceId: 1,
      botUserId: 'bot-1',
      clientId: 'client-1',
      name: 'Bot 1',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      instanceId: 2,
      botUserId: 'bot-2',
      clientId: 'client-2',
      name: 'Bot 2',
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  beforeEach(() => {
    pipelineMock.sismember.mockReset().mockReturnValue(pipelineMock);
    pipelineMock.exec.mockReset();
    redisMock.pipeline.mockClear();
    prismaMock.botInstance.findMany.mockReset();
    prismaMock.guildSettings.findUnique.mockReset();
    prismaMock.guildSettings.upsert.mockReset();
    prismaMock.boost.count.mockReset();
    redisMock.smembers.mockReset();
    redisMock.sismember.mockReset();
    cacheMock.invalidateGuildSettingsCache.mockReset();
    loggerMock.info.mockReset();
  });

  it('groups guilds by the registered bot instances', async () => {
    const instances: BotInstance[] = [
      {
        instanceId: 1,
        botUserId: 'bot-1',
        clientId: 'client-1',
        name: 'Bot 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        instanceId: 2,
        botUserId: 'bot-2',
        clientId: 'client-2',
        name: 'Bot 2',
        isActive: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ];
    redisMock.smembers
      .mockResolvedValueOnce(['guild-1', 'guild-2'])
      .mockResolvedValueOnce(['guild-1']);

    const result = await getBotGuildMemberships(instances);

    expect(result).toEqual(
      new Map([
        ['guild-1', [1, 2]],
        ['guild-2', [1]],
      ]),
    );
  });

  it('returns true when any instance is in the guild', async () => {
    pipelineMock.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 0],
      [null, 0],
    ]);

    const result = await getGuildsWithBotStatus(['guild-1', 'guild-2'], instances);

    expect(redisMock.pipeline).toHaveBeenCalledTimes(1);
    expect(pipelineMock.sismember).toHaveBeenCalledTimes(4);
    expect(result.get('guild-1')).toBe(true);
    expect(result.get('guild-2')).toBe(false);
  });

  it('returns false for all guilds when Redis pipeline fails', async () => {
    pipelineMock.exec.mockRejectedValue(new Error('redis error'));

    const result = await getGuildsWithBotStatus(['guild-1', 'guild-2'], instances);

    expect(result.get('guild-1')).toBe(false);
    expect(result.get('guild-2')).toBe(false);
  });

  it('returns default false map without touching Redis when input is empty', async () => {
    const result = await getGuildsWithBotStatus([], instances);

    expect(redisMock.pipeline).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('builds the guild bot list with defaults for available instances only', async () => {
    prismaMock.botInstance.findMany.mockResolvedValue([
      {
        instanceId: 1,
        botUserId: 'bot-1',
        clientId: 'client-1',
        name: 'Bot 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        instanceId: 2,
        botUserId: 'bot-2',
        clientId: 'client-2',
        name: 'Bot 2',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    prismaMock.guildSettings.findUnique
      .mockResolvedValueOnce({ manualPremium: false })
      .mockResolvedValueOnce({ manualPremium: false })
      .mockResolvedValueOnce({
        botInstanceSettings: {
          '1': {
            autoJoin: true,
            textChannelId: 'text-1',
            voiceChannelId: 'voice-1',
          },
        },
      });
    prismaMock.boost.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(2);
    redisMock.sismember = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const result = await getGuildBotList('guild-1');

    expect(result).toEqual({
      bots: [
        {
          instanceNumber: 1,
          name: 'Bot 1',
          botUserId: 'bot-1',
          isActive: true,
          isInGuild: true,
          isAvailable: true,
          settings: {
            autoJoin: true,
            textChannelId: 'text-1',
            voiceChannelId: 'voice-1',
            channelPairs: [{ voiceChannelId: 'voice-1', textChannelId: 'text-1' }],
          },
        },
        {
          instanceNumber: 2,
          name: 'Bot 2',
          botUserId: 'bot-2',
          isActive: true,
          isInGuild: false,
          isAvailable: true,
          settings: {
            autoJoin: false,
            textChannelId: null,
            voiceChannelId: null,
            channelPairs: [],
          },
        },
      ],
      boostCount: 2,
      maxBots: 2,
    });
  });

  it('persists a voice channel chat ID unchanged as textChannelId', async () => {
    const voiceChannelId = 'voice-channel-chat-id';
    prismaMock.guildSettings.findUnique.mockResolvedValue(null);

    await updateGuildBotInstanceSettings('guild-1', 1, {
      textChannelId: voiceChannelId,
    });

    expect(prismaMock.guildSettings.upsert).toHaveBeenCalledWith({
      where: { guildId: 'guild-1' },
      create: {
        guildId: 'guild-1',
        botInstanceSettings: {
          '1': {
            autoJoin: false,
            textChannelId: voiceChannelId,
            voiceChannelId: null,
            channelPairs: [],
          },
        },
      },
      update: {
        botInstanceSettings: {
          '1': {
            autoJoin: false,
            textChannelId: voiceChannelId,
            voiceChannelId: null,
            channelPairs: [],
          },
        },
      },
    });
    expect(cacheMock.invalidateGuildSettingsCache).toHaveBeenCalledWith('guild-1');
  });

  it('preserves multiple pairs when only autoJoin is updated', async () => {
    const firstPair = { voiceChannelId: 'voice-1', textChannelId: 'text-1' };
    const secondPair = { voiceChannelId: 'voice-2', textChannelId: 'text-2' };
    prismaMock.guildSettings.findUnique.mockResolvedValue({
      botInstanceSettings: {
        '1': {
          autoJoin: false,
          voiceChannelId: 'voice-1',
          textChannelId: 'text-1',
          channelPairs: [firstPair, secondPair],
        },
      },
    });

    const result = await updateGuildBotInstanceSettings('guild-1', 1, { autoJoin: true });

    expect(result).toEqual({
      autoJoin: true,
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      channelPairs: [firstPair, secondPair],
    });
    expect(prismaMock.guildSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        botInstanceSettings: expect.objectContaining({
          '1': {
            autoJoin: true,
            voiceChannelId: 'voice-1',
            textChannelId: 'text-1',
            channelPairs: [firstPair, secondPair],
          },
        }),
      },
    }));
  });

  it('keeps legacy field updates usable by updating the first new-format pair', async () => {
    prismaMock.guildSettings.findUnique.mockResolvedValue({
      botInstanceSettings: {
        '1': {
          autoJoin: true,
          voiceChannelId: 'voice-1',
          textChannelId: 'text-1',
          channelPairs: [
            { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
            { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
          ],
        },
      },
    });

    const result = await updateGuildBotInstanceSettings('guild-1', 1, {
      voiceChannelId: 'voice-updated',
    });

    expect(result).toEqual({
      autoJoin: true,
      voiceChannelId: 'voice-updated',
      textChannelId: 'text-1',
      channelPairs: [
        { voiceChannelId: 'voice-updated', textChannelId: 'text-1' },
        { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
      ],
    });
  });

  it('derives a pair when autoJoin is updated on legacy settings', async () => {
    prismaMock.guildSettings.findUnique.mockResolvedValue({
      botInstanceSettings: {
        '1': {
          autoJoin: true,
          voiceChannelId: 'legacy-voice',
          textChannelId: 'legacy-text',
        },
      },
    });

    const result = await updateGuildBotInstanceSettings('guild-1', 1, { autoJoin: false });

    expect(result).toEqual({
      autoJoin: false,
      voiceChannelId: 'legacy-voice',
      textChannelId: 'legacy-text',
      channelPairs: [{ voiceChannelId: 'legacy-voice', textChannelId: 'legacy-text' }],
    });
  });

  it('replaces channel pairs while preserving their submitted order', async () => {
    prismaMock.guildSettings.findUnique.mockResolvedValue({
      botInstanceSettings: {
        '1': {
          autoJoin: true,
          voiceChannelId: 'voice-old',
          textChannelId: 'text-old',
          channelPairs: [{ voiceChannelId: 'voice-old', textChannelId: 'text-old' }],
        },
        '2': {
          autoJoin: false,
          voiceChannelId: 'voice-other',
          textChannelId: 'text-other',
        },
      },
    });
    const replacement = [
      { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
      { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
    ];

    const result = await updateGuildBotInstanceSettings('guild-1', 1, {
      channelPairs: replacement,
    });

    expect(result.channelPairs).toEqual(replacement);
    expect(result.voiceChannelId).toBe('voice-2');
    expect(result.textChannelId).toBe('text-2');
    expect(prismaMock.guildSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: {
        botInstanceSettings: expect.objectContaining({
          '1': expect.objectContaining({ channelPairs: replacement }),
          '2': {
            autoJoin: false,
            voiceChannelId: 'voice-other',
            textChannelId: 'text-other',
          },
        }),
      },
    }));
  });

  it('rejects duplicate, incomplete, and over-limit pairs at the service boundary', async () => {
    await expect(updateGuildBotInstanceSettings('guild-1', 1, {
      channelPairs: [
        { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
        { voiceChannelId: 'voice-1', textChannelId: 'text-2' },
      ],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    await expect(updateGuildBotInstanceSettings('guild-1', 1, {
      channelPairs: [{ voiceChannelId: '', textChannelId: 'text-1' }],
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    const tooManyPairs = Array.from({ length: 26 }, (_, index) => ({
      voiceChannelId: `voice-${index}`,
      textChannelId: `text-${index}`,
    }));
    await expect(updateGuildBotInstanceSettings('guild-1', 1, {
      channelPairs: tooManyPairs,
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', statusCode: 400 });
    expect(prismaMock.guildSettings.upsert).not.toHaveBeenCalled();
  });

  it('returns active guild members as copy candidates without applying boost availability', async () => {
    const makeInstance = (instanceId: number, isActive = true): BotInstance => ({
      instanceId,
      botUserId: `bot-${instanceId}`,
      clientId: `client-${instanceId}`,
      name: `Bot ${instanceId}`,
      isActive,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    prismaMock.botInstance.findMany.mockResolvedValue([
      makeInstance(1),
      makeInstance(2),
      makeInstance(3, false),
      makeInstance(4),
    ]);
    redisMock.sismember.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    const result = await getCopyableBotInstances('guild-1', 1);

    expect(result.map((instance) => instance.instanceId)).toEqual([2]);
    expect(prismaMock.boost.count).not.toHaveBeenCalled();
  });

  it('copies a normalized source to multiple targets in one deep-copied upsert', async () => {
    const makeInstance = (instanceId: number): BotInstance => ({
      instanceId,
      botUserId: `bot-${instanceId}`,
      clientId: `client-${instanceId}`,
      name: `Bot ${instanceId}`,
      isActive: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    prismaMock.botInstance.findMany.mockResolvedValue([makeInstance(1), makeInstance(2), makeInstance(3)]);
    redisMock.sismember.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    prismaMock.guildSettings.findUnique.mockResolvedValue({
      botInstanceSettings: {
        '1': {
          autoJoin: true,
          voiceChannelId: 'voice-1',
          textChannelId: 'text-1',
          channelPairs: [
            { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
            { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
          ],
        },
        '2': {
          autoJoin: false,
          voiceChannelId: 'old-voice-2',
          textChannelId: 'old-text-2',
          channelPairs: [{ voiceChannelId: 'old-voice-2', textChannelId: 'old-text-2' }],
        },
      },
    });

    const result = await copyBotInstanceSettings('guild-1', 1, [2, 3]);
    const upsert = prismaMock.guildSettings.upsert.mock.calls[0]?.[0];
    const updatedMap = upsert?.update.botInstanceSettings as Record<string, Record<string, unknown>>;

    expect(result).toEqual({
      autoJoin: true,
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      channelPairs: [
        { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
        { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
      ],
    });
    expect(prismaMock.guildSettings.upsert).toHaveBeenCalledTimes(1);
    expect(updatedMap['2']).toEqual(result);
    expect(updatedMap['3']).toEqual(result);
    expect(updatedMap['2']).not.toBe(updatedMap['3']);
    expect(updatedMap['2']?.channelPairs).not.toBe(updatedMap['3']?.channelPairs);
    expect(cacheMock.invalidateGuildSettingsCache).toHaveBeenCalledWith('guild-1');
    expect(prismaMock.boost.count).not.toHaveBeenCalled();
  });

  it('normalizes a legacy source before copying it', async () => {
    prismaMock.botInstance.findMany.mockResolvedValue([
      {
        instanceId: 1,
        botUserId: 'bot-1',
        clientId: 'client-1',
        name: 'Bot 1',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        instanceId: 2,
        botUserId: 'bot-2',
        clientId: 'client-2',
        name: 'Bot 2',
        isActive: true,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    redisMock.sismember.mockResolvedValueOnce(1);
    prismaMock.guildSettings.findUnique.mockResolvedValue({
      botInstanceSettings: {
        '1': {
          autoJoin: true,
          voiceChannelId: 'legacy-voice',
          textChannelId: 'legacy-text',
        },
      },
    });

    await copyBotInstanceSettings('guild-1', 1, [2]);

    const upsert = prismaMock.guildSettings.upsert.mock.calls[0]?.[0];
    const updatedMap = upsert?.update.botInstanceSettings as Record<string, Record<string, unknown>>;
    expect(updatedMap['2']).toEqual({
      autoJoin: true,
      voiceChannelId: 'legacy-voice',
      textChannelId: 'legacy-text',
      channelPairs: [{ voiceChannelId: 'legacy-voice', textChannelId: 'legacy-text' }],
    });
  });

  it('rejects invalid copy targets before persisting anything', async () => {
    await expect(copyBotInstanceSettings('guild-1', 1, [])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    await expect(copyBotInstanceSettings('guild-1', 1, [1])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    await expect(copyBotInstanceSettings('guild-1', 1, [2, 2])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    expect(prismaMock.guildSettings.upsert).not.toHaveBeenCalled();
  });

  it('rejects targets that are not active guild members', async () => {
    prismaMock.botInstance.findMany.mockResolvedValue([]);

    await expect(copyBotInstanceSettings('guild-1', 1, [2])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      statusCode: 400,
    });
    expect(prismaMock.guildSettings.upsert).not.toHaveBeenCalled();
  });
});
