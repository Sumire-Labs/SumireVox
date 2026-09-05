import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REDIS_KEYS } from '@sumirevox/shared';

const { clientMock, redisMock, vcSessionMock } = vi.hoisted(() => ({
  clientMock: {
    shard: { ids: [1] },
    guilds: { cache: { get: vi.fn() } },
  },
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  vcSessionMock: {
    createVcSession: vi.fn(),
    destroyVcSession: vi.fn(),
    getVcSession: vi.fn(),
    updateTextChannel: vi.fn(),
  },
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: { botInstanceId: 2, defaultSpeakerId: 1 },
}));

vi.mock('../../infrastructure/discord-client.js', () => ({
  getClient: vi.fn(() => clientMock),
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('../../infrastructure/pubsub.js', () => ({
  publishEvent: vi.fn(),
}));

vi.mock('../vc-session-manager.js', () => vcSessionMock);

vi.mock('../guild-settings-service.js', () => ({
  getGuildSettings: vi.fn(),
}));

vi.mock('../predefined-audio-cache.js', () => ({
  getPredefinedAudio: vi.fn(),
}));

vi.mock('../speech-queue.js', () => ({
  enqueuePreSynthesized: vi.fn(),
}));

import { handleDelegatedBotCommand } from '../bot-command-delegation-service.js';

describe('handleDelegatedBotCommand', () => {
  const command = {
    requestId: 'request-1',
    targetShardId: 1,
    action: 'join' as const,
    guildId: 'guild-1',
    voiceChannelId: 'voice-1',
    textChannelId: 'text-2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clientMock.shard.ids = [1];
    clientMock.guilds.cache.get.mockReturnValue({ voiceAdapterCreator: {} });
    redisMock.set.mockResolvedValue('OK');
    vcSessionMock.getVcSession.mockReturnValue({
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      connectionMode: 'auto',
    });
  });

  it('対象外のシャードでは実行も結果書き込みもしない', () => {
    clientMock.shard.ids = [0];

    handleDelegatedBotCommand(JSON.stringify(command));

    expect(vcSessionMock.updateTextChannel).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('担当シャードだけが同一VCのTC変更をmanualとして実行し結果を保存する', async () => {
    handleDelegatedBotCommand(JSON.stringify(command));

    await vi.waitFor(() => {
      expect(vcSessionMock.updateTextChannel).toHaveBeenCalledWith('guild-1', 'text-2', 'manual');
      expect(redisMock.set).toHaveBeenCalledWith(
        REDIS_KEYS.BOT_COMMAND_RESULT('request-1'),
        JSON.stringify({ success: true }),
        'EX',
        35,
      );
    });
  });
});
