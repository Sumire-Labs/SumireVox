import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: loggerMock,
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: {
    discordBotToken: 'bot-token',
  },
}));

import { hasManageGuildPermission } from '../discord-api.js';

function guildResponse(guilds: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => guilds,
  } as unknown as Response;
}

describe('discord-api', () => {
  beforeEach(() => {
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns false (does not throw) when a guild has no permissions field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        guildResponse([
          { id: 'guild-1', name: 'Guild', icon: null, owner: false },
        ]),
      ),
    );

    const result = await hasManageGuildPermission('access-token', 'guild-1');

    expect(result).toBe(false);
  });
});