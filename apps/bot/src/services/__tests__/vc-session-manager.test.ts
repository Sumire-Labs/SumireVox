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
  getAllVcSessionsForShard: vi.fn(),
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
  getAllVcSessionsForShard,
  removeVcSessionFromRedis,
  saveVcSessionToRedis,
} from '../../infrastructure/vc-session-store.js';
import {
  createVcSession,
  getAllVcSessions,
  getVcSession,
  moveVcSession,
  restoreVcSessions,
  updateTextChannel,
} from '../vc-session-manager.js';

const mockJoinVoiceChannel = vi.mocked(joinVoiceChannel);
const mockEntersState = vi.mocked(entersState);
const mockGetVoiceConnection = vi.mocked(getVoiceConnection);
const mockGetClient = vi.mocked(getClient);
const mockSaveVcSessionToRedis = vi.mocked(saveVcSessionToRedis);
const mockRemoveVcSessionFromRedis = vi.mocked(removeVcSessionFromRedis);
const mockGetAllVcSessionsForShard = vi.mocked(getAllVcSessionsForShard);
const mockDeleteGuildQueue = vi.mocked(deleteGuildQueue);

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

  it('モードのない旧Redisセッションはmanualとして復旧する', async () => {
    const connection = makeConnection();
    mockJoinVoiceChannel.mockReturnValue(connection as never);
    const savedSession: VcSession = {
      guildId: 'guild-1',
      voiceChannelId: 'voice-1',
      textChannelId: 'text-1',
      shardId: 0,
      botInstanceId: 1,
    };
    mockGetAllVcSessionsForShard.mockResolvedValue([savedSession]);
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
});
