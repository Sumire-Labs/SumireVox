import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REDIS_KEYS } from '@sumirevox/shared';

const { clientMock, redisMock, vcSessionMock, guildSettingsMock } = vi.hoisted(() => ({
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
  guildSettingsMock: vi.fn(),
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
  getGuildSettings: guildSettingsMock,
}));

vi.mock('../predefined-audio-cache.js', () => ({
  getPredefinedAudio: vi.fn(),
}));

vi.mock('../speech-queue.js', () => ({
  enqueuePreSynthesized: vi.fn(),
}));

import { handleDelegatedBotCommand } from '../bot-command-delegation-service.js';
import { getGuildSettings } from '../guild-settings-service.js';

const mockGetGuildSettings = vi.mocked(getGuildSettings);

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
    mockGetGuildSettings.mockResolvedValue({
      greetingOnJoin: false,
      defaultSpeakerId: null,
    } as Awaited<ReturnType<typeof getGuildSettings>>);
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
        JSON.stringify({ success: true, operation: 'updated' }),
        'EX',
        35,
      );
    });
  });

  it('自動接続の委譲はautoモードでセッションを作成する', async () => {
    vcSessionMock.getVcSession.mockReturnValue(undefined);
    vcSessionMock.createVcSession.mockResolvedValue(undefined);

    handleDelegatedBotCommand(JSON.stringify({
      ...command,
      requestId: 'request-auto',
      connectionMode: 'auto',
    }));

    await vi.waitFor(() => {
      expect(vcSessionMock.createVcSession).toHaveBeenCalledWith(
        'guild-1',
        'voice-1',
        'text-2',
        expect.anything(),
        'auto',
      );
      expect(redisMock.set).toHaveBeenCalledWith(
        REDIS_KEYS.BOT_COMMAND_RESULT('request-auto'),
        JSON.stringify({ success: true, operation: 'created' }),
        'EX',
        35,
      );
    });
  });

  it('自動接続の競合で既存の手動セッションを変更しない', async () => {
    vcSessionMock.getVcSession.mockReturnValue({
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      connectionMode: 'manual',
    });

    handleDelegatedBotCommand(JSON.stringify({
      ...command,
      requestId: 'request-auto-existing',
      connectionMode: 'auto',
    }));

    await vi.waitFor(() => {
      expect(vcSessionMock.updateTextChannel).not.toHaveBeenCalled();
      expect(redisMock.set).toHaveBeenCalledWith(
        REDIS_KEYS.BOT_COMMAND_RESULT('request-auto-existing'),
        JSON.stringify({ success: true, operation: 'existing' }),
        'EX',
        35,
      );
    });
  });
});
