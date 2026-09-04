import type { VcSession } from '@sumirevox/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const voiceConnectionStatus = vi.hoisted(() => ({
  Ready: 'ready',
  Disconnected: 'disconnected',
  Signalling: 'signalling',
  Connecting: 'connecting',
  Destroyed: 'destroyed',
} as const));

vi.mock('@discordjs/voice', () => ({
  VoiceConnectionStatus: voiceConnectionStatus,
  joinVoiceChannel: vi.fn(),
  entersState: vi.fn().mockResolvedValue(undefined),
  getVoiceConnection: vi.fn(),
}));

vi.mock('../../infrastructure/vc-session-store.js', () => ({
  saveVcSessionToRedis: vi.fn(),
  removeVcSessionFromRedis: vi.fn(),
  getAllVcSessionsForBotInstance: vi.fn(),
}));

vi.mock('../../infrastructure/discord-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: { botInstanceId: 1 },
}));

vi.mock('../speech-queue.js', () => ({
  deleteGuildQueue: vi.fn(),
}));

vi.mock('../text-pipeline/index.js', () => ({
  initTrieSlot: vi.fn(),
  destroyTrieSlot: vi.fn(),
}));

vi.mock('../auto-disconnect-timer.js', () => ({
  cancelDisconnectTimer: vi.fn(),
}));

vi.mock('../vc-ownership-service.js', () => ({
  claimVcOwnership: vi.fn(async (_guildId: string, _voiceChannelId: string, instanceId: number) => ({ instanceId, claimId: 'claim-1' })),
  getVcOwnershipRecoveryDelayMs: vi.fn(async () => 0),
  moveVcOwnership: vi.fn(async (_guildId: string, _from: string, _to: string, ownership: { instanceId: number }) => ({ ...ownership, claimId: 'claim-2' })),
  renewVcOwnership: vi.fn(async () => true),
  releaseVcOwnership: vi.fn(async () => {}),
  rollbackVcOwnershipMove: vi.fn(async () => {}),
}));

import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
} from '@discordjs/voice';
import { getClient } from '../../infrastructure/discord-client.js';
import { deleteGuildQueue } from '../speech-queue.js';
import {
  getAllVcSessionsForBotInstance,
  removeVcSessionFromRedis,
  saveVcSessionToRedis,
} from '../../infrastructure/vc-session-store.js';
import { cancelDisconnectTimer } from '../auto-disconnect-timer.js';
import { destroyTrieSlot } from '../text-pipeline/index.js';
import {
  claimVcOwnership,
  getVcOwnershipRecoveryDelayMs,
  releaseVcOwnership,
} from '../vc-ownership-service.js';
import {
  createVcSession,
  cancelAllVcSessionRecovery,
  destroyVcSession,
  getAllVcSessions,
  getConnection,
  getVcSession,
  moveVcSession,
  restoreVcSessions,
  destroyAllVcSessionsForRestart,
  updateTextChannel,
} from '../vc-session-manager.js';

const mockJoinVoiceChannel = vi.mocked(joinVoiceChannel);
const mockEntersState = vi.mocked(entersState);
const mockGetVoiceConnection = vi.mocked(getVoiceConnection);
const mockGetClient = vi.mocked(getClient);
const mockSaveVcSessionToRedis = vi.mocked(saveVcSessionToRedis);
const mockRemoveVcSessionFromRedis = vi.mocked(removeVcSessionFromRedis);
const mockGetAllVcSessionsForBotInstance = vi.mocked(getAllVcSessionsForBotInstance);
const mockClaimVcOwnership = vi.mocked(claimVcOwnership);
const mockGetVcOwnershipRecoveryDelayMs = vi.mocked(getVcOwnershipRecoveryDelayMs);
const mockDeleteGuildQueue = vi.mocked(deleteGuildQueue);
const mockCancelDisconnectTimer = vi.mocked(cancelDisconnectTimer);
const mockDestroyTrieSlot = vi.mocked(destroyTrieSlot);
const mockReleaseVcOwnership = vi.mocked(releaseVcOwnership);

function makeConnection() {
  return {
    state: { status: voiceConnectionStatus.Ready },
    on: vi.fn(),
    destroy: vi.fn(),
  };
}

function makeGuild() {
  return {
    id: 'guild-1',
    voiceAdapterCreator: {},
    channels: {
      cache: {
        get: () => ({ isVoiceBased: () => true }),
      },
    },
  };
}

describe('vc-session-manager connection mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    cancelAllVcSessionRecovery();
    getAllVcSessions().clear();
    mockGetVoiceConnection.mockReturnValue(undefined);
    mockEntersState.mockResolvedValue(undefined as never);
    mockGetClient.mockReturnValue({
      shard: { ids: [0] },
    } as unknown as ReturnType<typeof getClient>);
  });

  it('自動接続セッションをRedisへautoモードで保存する', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);

    const session = await createVcSession(
      'guild-1',
      'voice-1',
      'text-1',
      {} as never,
      'auto',
    );

    expect(session.connectionMode).toBe('auto');
    expect(mockSaveVcSessionToRedis).toHaveBeenCalledWith(session);
  });

  it('再起動時はローカル状態と接続を破棄するが、復元情報を残してleaseだけ解放する', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    await createVcSession('guild-1', 'voice-1', 'text-1', {} as never, 'auto');

    const destroyedHandler = connection.on.mock.calls.find(
      ([event]) => event === voiceConnectionStatus.Destroyed,
    )?.[1] as (() => void) | undefined;
    expect(destroyedHandler).toBeDefined();
    connection.destroy.mockImplementation(() => destroyedHandler?.());

    await destroyAllVcSessionsForRestart();

    expect(connection.destroy).toHaveBeenCalledTimes(1);
    expect(getAllVcSessions().size).toBe(0);
    expect(getVcSession('guild-1')).toBeUndefined();
    expect(getConnection('guild-1')).toBeUndefined();
    expect(mockDeleteGuildQueue).toHaveBeenCalledWith('guild-1');
    expect(mockCancelDisconnectTimer).toHaveBeenCalledWith('guild-1');
    expect(mockDestroyTrieSlot).toHaveBeenCalledWith('guild-1');
    expect(mockRemoveVcSessionFromRedis).not.toHaveBeenCalled();
    expect(mockReleaseVcOwnership).toHaveBeenCalledWith('guild-1', 'voice-1', {
      instanceId: 1,
      claimId: 'claim-1',
    });

    destroyedHandler?.();
    expect(mockRemoveVcSessionFromRedis).not.toHaveBeenCalled();
  });

  it('通常のセッション破棄ではRedisの復元情報とownership leaseを削除する', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    await createVcSession('guild-1', 'voice-1', 'text-1', {} as never);

    await destroyVcSession('guild-1');

    expect(mockRemoveVcSessionFromRedis).toHaveBeenCalledWith('guild-1', 1);
    expect(mockReleaseVcOwnership).toHaveBeenCalledWith('guild-1', 'voice-1', {
      instanceId: 1,
      claimId: 'claim-1',
    });
  });

  it('予期しない接続破棄ではRedisの復元情報を保持して復旧対象にする', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    await createVcSession('guild-1', 'voice-1', 'text-1', {} as never);

    const destroyedHandler = connection.on.mock.calls.find(
      ([event]) => event === voiceConnectionStatus.Destroyed,
    )?.[1] as (() => void) | undefined;
    destroyedHandler?.();

    await vi.waitFor(() => {
      expect(getVcSession('guild-1')).toBeUndefined();
    });
    expect(mockRemoveVcSessionFromRedis).not.toHaveBeenCalled();
  });

  it('/join相当のTC更新でセッションをmanualへ変更する', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    await createVcSession('guild-1', 'voice-1', 'text-1', {} as never, 'auto');

    await updateTextChannel('guild-1', 'text-2', 'manual');

    expect(getVcSession('guild-1')).toMatchObject({
      voiceChannelId: 'voice-1',
      textChannelId: 'text-2',
      connectionMode: 'manual',
    });
  });

  it('VC移動時にVC/TCとautoモードを同時に更新する', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    await createVcSession('guild-1', 'voice-1', 'text-1', {} as never, 'auto');

    const moved = await moveVcSession(
      'guild-1',
      'voice-2',
      'text-2',
      {} as never,
      'auto',
    );

    expect(moved).toMatchObject({
      voiceChannelId: 'voice-2',
      textChannelId: 'text-2',
      connectionMode: 'auto',
    });
    expect(mockJoinVoiceChannel).toHaveBeenLastCalledWith({
      channelId: 'voice-2',
      guildId: 'guild-1',
      adapterCreator: {},
      selfDeaf: true,
      selfMute: false,
    });
    expect(mockSaveVcSessionToRedis).toHaveBeenLastCalledWith(moved);
    expect(mockDeleteGuildQueue).toHaveBeenCalledWith('guild-1');
  });

  it('保存時と異なるシャードでも、現在の所有シャードで旧Redisセッションをmanualとして復旧する', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    const savedSession: VcSession = {
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      shardId: 7,
      botInstanceId: 1,
    };
    mockGetAllVcSessionsForBotInstance.mockResolvedValue([savedSession]);
    const guild = makeGuild();
    mockGetClient.mockReturnValue({
      shard: { ids: [0] },
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await restoreVcSessions();

    expect(getVcSession('guild-1')).toMatchObject({
      connectionMode: 'manual',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
    });
    expect(mockRemoveVcSessionFromRedis).not.toHaveBeenCalled();
  });

  it('異常終了後のlease競合では記録を保持し、失効後に再試行する', async () => {
    vi.useFakeTimers();
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    mockClaimVcOwnership.mockResolvedValueOnce(null).mockResolvedValueOnce({
      instanceId: 1,
      claimId: 'claim-2',
    });
    mockGetVcOwnershipRecoveryDelayMs.mockResolvedValue(100);
    const savedSession: VcSession = {
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      shardId: 0,
      botInstanceId: 1,
      claimId: 'expired-process-claim',
      connectionMode: 'auto',
    };
    mockGetAllVcSessionsForBotInstance.mockResolvedValue([savedSession]);
    const guild = makeGuild();
    mockGetClient.mockReturnValue({
      shard: { ids: [0] },
      guilds: { cache: { has: () => true, get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await restoreVcSessions();

    expect(mockRemoveVcSessionFromRedis).not.toHaveBeenCalled();
    expect(getVcSession('guild-1')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(100);
    expect(getVcSession('guild-1')).toMatchObject({
      voiceChannelId: 'voice-1',
      claimId: 'claim-2',
    });
  });

  it('Discord側にBotのVC状態が残っていても復元情報を保持して再接続する', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    const savedSession: VcSession = {
      guildId: 'guild-1', voiceChannelId: 'voice-1', textChannelId: 'text-1', shardId: 0, botInstanceId: 1,
    };
    mockGetAllVcSessionsForBotInstance.mockResolvedValue([savedSession]);
    const guild = {
      ...makeGuild(),
      members: { me: { voice: { channelId: 'voice-1' } } },
    };
    mockGetClient.mockReturnValue({
      shard: { ids: [0] },
      guilds: { cache: { has: () => true, get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await restoreVcSessions();

    expect(mockJoinVoiceChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveVcSessionFromRedis).not.toHaveBeenCalled();
    expect(getVcSession('guild-1')).toMatchObject({ voiceChannelId: 'voice-1' });
  });

  it('削除済みVCの記録も明示的な退出まで保持する', async () => {
    const savedSession: VcSession = {
      guildId: 'guild-1', voiceChannelId: 'deleted-voice', textChannelId: 'text-1', shardId: 0, botInstanceId: 1,
    };
    mockGetAllVcSessionsForBotInstance.mockResolvedValue([savedSession]);
    const guild = {
      ...makeGuild(),
      channels: { cache: { get: () => undefined } },
    };
    mockGetClient.mockReturnValue({
      shard: { ids: [0] },
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await restoreVcSessions();

    expect(mockRemoveVcSessionFromRedis).not.toHaveBeenCalled();
  });

  it('Discord接続の一時失敗では記録を削除せず、バックオフして再試行する', async () => {
    vi.useFakeTimers();
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    mockEntersState.mockRejectedValueOnce(new Error('Discord unavailable')).mockResolvedValueOnce(undefined as never);
    mockGetVcOwnershipRecoveryDelayMs.mockResolvedValue(0);
    const savedSession: VcSession = {
      guildId: 'guild-1', voiceChannelId: 'voice-1', textChannelId: 'text-1', shardId: 0, botInstanceId: 1,
    };
    mockGetAllVcSessionsForBotInstance.mockResolvedValue([savedSession]);
    const guild = makeGuild();
    mockGetClient.mockReturnValue({
      shard: { ids: [0] },
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await restoreVcSessions();
    expect(mockRemoveVcSessionFromRedis).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(getVcSession('guild-1')).toMatchObject({ voiceChannelId: 'voice-1' });
  });

  it('停止時に保留中の復旧をキャンセルする', async () => {
    vi.useFakeTimers();
    mockClaimVcOwnership.mockResolvedValue(null);
    mockGetVcOwnershipRecoveryDelayMs.mockResolvedValue(100);
    const savedSession: VcSession = {
      guildId: 'guild-1', voiceChannelId: 'voice-1', textChannelId: 'text-1', shardId: 0, botInstanceId: 1,
    };
    mockGetAllVcSessionsForBotInstance.mockResolvedValue([savedSession]);
    const guild = makeGuild();
    mockGetClient.mockReturnValue({
      shard: { ids: [0] },
      guilds: { cache: { has: () => true, get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await restoreVcSessions();
    cancelAllVcSessionRecovery();
    await vi.advanceTimersByTimeAsync(100);

    expect(mockClaimVcOwnership).toHaveBeenCalledTimes(1);
  });
});
