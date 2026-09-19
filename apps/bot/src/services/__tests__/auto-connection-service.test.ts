import type { GuildSettings, ResolvedBotInstanceSettings, VcSession } from '@sumirevox/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisMock } = vi.hoisted(() => ({
  redisMock: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../infrastructure/discord-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: {
    botInstanceId: 1,
    defaultSpeakerId: 10,
    voiceDisconnectTimeoutSeconds: 1,
  },
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('../guild-settings-service.js', () => ({
  getGuildSettings: vi.fn(),
  getInstanceSettings: vi.fn(),
  getAutoJoinSettings: vi.fn(),
}));

vi.mock('../vc-session-manager.js', () => ({
  createVcSession: vi.fn(),
  destroyVcSession: vi.fn(),
  getAllVcSessions: vi.fn(),
  getVcSession: vi.fn(),
  moveVcSession: vi.fn(),
}));

vi.mock('../vc-allocation-service.js', () => ({
  allocateVoiceConnection: vi.fn(),
}));

vi.mock('../premium-service.js', () => ({
  canInstanceConnect: vi.fn(),
  getAvailableBotInstanceIds: vi.fn(),
}));

vi.mock('../../infrastructure/redis.js', () => ({
  getRedisClient: vi.fn(() => redisMock),
}));

vi.mock('../auto-disconnect-timer.js', () => ({
  cancelDisconnectTimer: vi.fn(),
  startDisconnectTimer: vi.fn(),
}));

vi.mock('../speech-queue.js', () => ({
  enqueuePreSynthesized: vi.fn(),
}));

vi.mock('../predefined-audio-cache.js', () => ({
  getPredefinedAudio: vi.fn(),
}));

import { getClient } from '../../infrastructure/discord-client.js';
import { getGuildSettings, getInstanceSettings, getAutoJoinSettings } from '../guild-settings-service.js';
import {
  createVcSession,
  destroyVcSession,
  getAllVcSessions,
  getVcSession,
  moveVcSession,
} from '../vc-session-manager.js';
import { allocateVoiceConnection } from '../vc-allocation-service.js';
import { canInstanceConnect, getAvailableBotInstanceIds } from '../premium-service.js';
import { cancelDisconnectTimer, startDisconnectTimer } from '../auto-disconnect-timer.js';
import { enqueuePreSynthesized } from '../speech-queue.js';
import { getPredefinedAudio } from '../predefined-audio-cache.js';
import {
  checkAutoDisconnect,
  handleAutoDisconnectTimerExpired,
  handleAutoJoinVoiceState,
  scheduleDisconnectTimersForRestoredSessions,
} from '../auto-connection-service.js';

const mockGetClient = vi.mocked(getClient);
const mockGetGuildSettings = vi.mocked(getGuildSettings);
const mockGetInstanceSettings = vi.mocked(getInstanceSettings);
const mockGetAutoJoinSettings = vi.mocked(getAutoJoinSettings);
const mockCreateVcSession = vi.mocked(createVcSession);
const mockDestroyVcSession = vi.mocked(destroyVcSession);
const mockGetAllVcSessions = vi.mocked(getAllVcSessions);
const mockGetVcSession = vi.mocked(getVcSession);
const mockMoveVcSession = vi.mocked(moveVcSession);
const mockCanInstanceConnect = vi.mocked(canInstanceConnect);
const mockGetAvailableBotInstanceIds = vi.mocked(getAvailableBotInstanceIds);
const mockCancelDisconnectTimer = vi.mocked(cancelDisconnectTimer);
const mockStartDisconnectTimer = vi.mocked(startDisconnectTimer);
const mockGetPredefinedAudio = vi.mocked(getPredefinedAudio);
const mockEnqueuePreSynthesized = vi.mocked(enqueuePreSynthesized);
const mockAllocateVoiceConnection = vi.mocked(allocateVoiceConnection);

function makeSettings(): GuildSettings {
  return {
    guildId: 'guild-1',
    maxReadLength: 50,
    readUsername: false,
    addSanSuffix: false,
    romajiReading: false,
    uppercaseReading: false,
    joinLeaveNotification: false,
    greetingOnJoin: false,
    customEmojiHandling: 'read_name',
    readTargetType: 'text_sticker_and_attachment',
    defaultTextChannelId: null,
    defaultSpeakerId: 20,
    adminRoleId: null,
    dictionaryPermission: 'admin_only',
    manualPremium: false,
    botInstanceSettings: {},
  };
}

function makeInstanceSettings(
  overrides: Partial<ResolvedBotInstanceSettings> = {},
): ResolvedBotInstanceSettings {
  return {
    autoJoin: true,
    voiceChannelId: 'voice-1',
    textChannelId: 'text-1',
    channelPairs: [
      { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
      { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
    ],
    ...overrides,
  };
}

function makeVoiceChannel(
  id: string,
  humanMemberCount: number,
  permissions = true,
) {
  const members = Array.from({ length: humanMemberCount }, (_, index) => ({
    user: { bot: false },
    id: `user-${id}-${index}`,
  }));
  return {
    id,
    isVoiceBased: () => true,
    isTextBased: () => false,
    members: { values: () => members.values() },
    permissionsFor: () => ({ has: () => permissions }),
  };
}

function makeTextChannel(id: string) {
  return { id, isTextBased: () => true, isVoiceBased: () => false, send: vi.fn() };
}

function makeGuild(channels: Record<string, unknown>) {
  const cache = new Map(Object.entries(channels));
  const guild = {
    id: 'guild-1',
    channels: { cache: { get: (channelId: string) => cache.get(channelId) } },
    members: { me: { id: 'bot-user' } },
    voiceAdapterCreator: {},
  };
  return guild as Parameters<typeof handleAutoJoinVoiceState>[1]['guild'];
}

function makeState(guild: ReturnType<typeof makeGuild>, channelId: string | null) {
  return {
    guild,
    channelId,
    member: { id: 'user-1', user: { bot: false }, displayName: 'User' },
  } as Parameters<typeof handleAutoJoinVoiceState>[0];
}

function makeSession(overrides: Partial<VcSession> = {}): VcSession {
  return {
    guildId: 'guild-1',
    voiceChannelId: 'voice-1',
    textChannelId: 'text-1',
    shardId: 0,
    botInstanceId: 2,
    connectionMode: 'auto',
    ...overrides,
  };
}

describe('auto-connection-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGuildSettings.mockResolvedValue(makeSettings());
    mockGetInstanceSettings.mockReturnValue(makeInstanceSettings());
    mockGetAutoJoinSettings.mockReturnValue(makeInstanceSettings());
    mockGetVcSession.mockReturnValue(undefined);
    mockGetAllVcSessions.mockReturnValue(new Map());
    mockCanInstanceConnect.mockResolvedValue(true);
    mockGetAvailableBotInstanceIds.mockResolvedValue([1]);
    mockGetPredefinedAudio.mockResolvedValue(null);
    mockAllocateVoiceConnection.mockResolvedValue({ status: 'connected', instanceId: 2 });
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue('OK');
    mockGetClient.mockReturnValue({ guilds: { cache: { get: vi.fn() } } } as unknown as ReturnType<typeof getClient>);
  });

  it('対象VCの参加だけをペア対応TCで自動接続する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
      'voice-2': makeVoiceChannel('voice-2', 1),
      'text-2': makeTextChannel('text-2'),
    });
    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-2'));

    expect(mockAllocateVoiceConnection).toHaveBeenCalledWith({
      guildId: 'guild-1',
      voiceChannelId: 'voice-2',
      textChannelId: 'text-2',
      connectionMode: 'auto',
      existingOwnerBehavior: 'preserve',
    });
  });

  it('対象外VC、権限不足、Premium不足では接続しない', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1, false),
      'text-1': makeTextChannel('text-1'),
    });

    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'other-voice'));
    expect(mockAllocateVoiceConnection).not.toHaveBeenCalled();

    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    expect(mockAllocateVoiceConnection).not.toHaveBeenCalled();

    mockAllocateVoiceConnection.mockResolvedValue({ status: 'capacity' });
    const allowedGuild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
    });
    await handleAutoJoinVoiceState(makeState(allowedGuild, null), makeState(allowedGuild, 'voice-1'));
    expect(mockAllocateVoiceConnection).toHaveBeenCalledTimes(1);
  });

  it('同時の自動接続イベントは1つの接続処理へ直列化する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
    });
    let resolveAllocation: (result: { status: 'connected'; instanceId: number }) => void = () => {};
    const allocationPromise = new Promise<{ status: 'connected'; instanceId: number }>((resolve) => {
      resolveAllocation = resolve;
    });
    let currentSession: VcSession | undefined;
    mockGetVcSession.mockImplementation(() => currentSession);
    mockAllocateVoiceConnection.mockImplementation(async () => {
      const result = await allocationPromise;
      currentSession = makeSession();
      return result;
    });

    const first = handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    const second = handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    await vi.waitFor(() => expect(mockAllocateVoiceConnection).toHaveBeenCalledTimes(1));

    resolveAllocation({ status: 'connected', instanceId: 2 });
    await Promise.all([first, second]);
    expect(mockAllocateVoiceConnection).toHaveBeenCalledTimes(1);
  });

  it('タイマー確認時に人間が戻っていれば維持する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
    });
    mockGetVcSession.mockReturnValue(makeSession());
    mockGetClient.mockReturnValue({
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await handleAutoDisconnectTimerExpired('guild-1');

    expect(mockMoveVcSession).not.toHaveBeenCalled();
    expect(mockDestroyVcSession).not.toHaveBeenCalled();
  });

  it('候補を人数最多、同数時は設定順で選び、ペアのTCへ移動する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 0),
      'text-1': makeTextChannel('text-1'),
      'voice-2': makeVoiceChannel('voice-2', 2),
      'text-2': makeTextChannel('text-2'),
      'voice-3': makeVoiceChannel('voice-3', 2),
      'text-3': makeTextChannel('text-3'),
    });
    mockGetVcSession.mockReturnValue(makeSession());
    mockGetAutoJoinSettings.mockReturnValue(
      makeInstanceSettings({
        channelPairs: [
          { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
          { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
          { voiceChannelId: 'voice-3', textChannelId: 'text-3' },
        ],
      }),
    );
    mockGetClient.mockReturnValue({
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await handleAutoDisconnectTimerExpired('guild-1');

    expect(mockMoveVcSession).toHaveBeenCalledWith(
      'guild-1',
      'voice-2',
      'text-2',
      guild.voiceAdapterCreator,
      'auto',
    );
    expect(mockDestroyVcSession).not.toHaveBeenCalled();
  });

  it('削除済みVC、TC、権限不足の候補を飛ばして次の候補を選ぶ', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 0),
      'text-1': makeTextChannel('text-1'),
      'voice-2': makeVoiceChannel('voice-2', 3, false),
      'text-2': makeTextChannel('text-2'),
      'voice-3': makeVoiceChannel('voice-3', 1),
      'text-3': makeTextChannel('text-3'),
      'voice-4': makeVoiceChannel('voice-4', 4),
    });
    mockGetVcSession.mockReturnValue(makeSession());
    mockGetAutoJoinSettings.mockReturnValue(
      makeInstanceSettings({
        channelPairs: [
          { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
          { voiceChannelId: 'missing-voice', textChannelId: 'text-2' },
          { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
          { voiceChannelId: 'voice-3', textChannelId: 'missing-text' },
          { voiceChannelId: 'voice-4', textChannelId: 'text-4' },
        ],
      }),
    );
    mockGetClient.mockReturnValue({
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await handleAutoDisconnectTimerExpired('guild-1');

    expect(mockMoveVcSession).not.toHaveBeenCalled();
    expect(mockDestroyVcSession).toHaveBeenCalledWith('guild-1');
  });

  it('最多候補への移動に失敗しても、次点の接続可能な候補を試す', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 0),
      'text-1': makeTextChannel('text-1'),
      'voice-2': makeVoiceChannel('voice-2', 3),
      'text-2': makeTextChannel('text-2'),
      'voice-3': makeVoiceChannel('voice-3', 2),
      'text-3': makeTextChannel('text-3'),
    });
    mockGetVcSession.mockReturnValue(makeSession());
    mockGetAutoJoinSettings.mockReturnValue(
      makeInstanceSettings({
        channelPairs: [
          { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
          { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
          { voiceChannelId: 'voice-3', textChannelId: 'text-3' },
        ],
      }),
    );
    mockMoveVcSession
      .mockRejectedValueOnce(new Error('voice-2 unavailable'))
      .mockResolvedValueOnce(makeSession({ voiceChannelId: 'voice-3', textChannelId: 'text-3' }));
    mockGetClient.mockReturnValue({
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await handleAutoDisconnectTimerExpired('guild-1');

    expect(mockMoveVcSession).toHaveBeenNthCalledWith(
      1,
      'guild-1',
      'voice-2',
      'text-2',
      guild.voiceAdapterCreator,
      'auto',
    );
    expect(mockMoveVcSession).toHaveBeenNthCalledWith(
      2,
      'guild-1',
      'voice-3',
      'text-3',
      guild.voiceAdapterCreator,
      'auto',
    );
    expect(mockDestroyVcSession).not.toHaveBeenCalled();
  });

  it('全候補が無人なら退出し、手動セッションは維持する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 0),
      'text-1': makeTextChannel('text-1'),
      'voice-2': makeVoiceChannel('voice-2', 0),
      'text-2': makeTextChannel('text-2'),
    });
    mockGetClient.mockReturnValue({
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    mockGetVcSession.mockReturnValue(makeSession());
    await handleAutoDisconnectTimerExpired('guild-1');
    expect(mockDestroyVcSession).toHaveBeenCalledWith('guild-1');

    vi.clearAllMocks();
    mockGetVcSession.mockReturnValue(makeSession({ connectionMode: 'manual' }));
    await handleAutoDisconnectTimerExpired('guild-1');
    expect(mockDestroyVcSession).not.toHaveBeenCalled();
    expect(mockMoveVcSession).not.toHaveBeenCalled();
  });

  it('無人の自動セッションだけタイマーを開始し、復帰時にキャンセルする', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 0),
      'text-1': makeTextChannel('text-1'),
    });
    mockGetVcSession.mockReturnValue(makeSession());
    await checkAutoDisconnect('guild-1', guild, 'voice-1');
    expect(mockStartDisconnectTimer).toHaveBeenCalledWith(
      'guild-1',
      expect.any(Function),
    );

    vi.clearAllMocks();
    const occupiedGuild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
    });
    await checkAutoDisconnect('guild-1', occupiedGuild, 'voice-1');
    expect(mockCancelDisconnectTimer).toHaveBeenCalledWith('guild-1');
  });

  it('復旧した自動セッションの無人タイマーを再構築する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 0),
      'text-1': makeTextChannel('text-1'),
    });
    const session = makeSession();
    mockGetAllVcSessions.mockReturnValue(new Map([['guild-1', session]]));
    mockGetVcSession.mockReturnValue(session);
    mockGetClient.mockReturnValue({
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);

    await scheduleDisconnectTimersForRestoredSessions();

    expect(mockStartDisconnectTimer).toHaveBeenCalledWith('guild-1', expect.any(Function));
  });

  it('自動接続をautoモードで委譲し、切り替え時は挨拶しない', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
    });
    mockGetGuildSettings.mockResolvedValue({ ...makeSettings(), greetingOnJoin: true });
    mockGetVcSession.mockReturnValue(undefined);

    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    expect(mockAllocateVoiceConnection).toHaveBeenCalledWith(expect.objectContaining({
      connectionMode: 'auto',
    }));

    vi.clearAllMocks();
    mockGetVcSession.mockReturnValue(makeSession());
    mockGetClient.mockReturnValue({
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);
    await handleAutoDisconnectTimerExpired('guild-1');
    expect(mockEnqueuePreSynthesized).not.toHaveBeenCalled();
  });

  it('容量不足通知をVCごとに30秒抑止する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
      'voice-2': makeVoiceChannel('voice-2', 1),
      'text-2': makeTextChannel('text-2'),
    });
    mockAllocateVoiceConnection.mockResolvedValue({ status: 'capacity' });
    mockGetAutoJoinSettings.mockReturnValue(makeInstanceSettings({
      channelPairs: [
        { voiceChannelId: 'voice-1', textChannelId: 'text-1' },
        { voiceChannelId: 'voice-2', textChannelId: 'text-2' },
      ],
    }));
    redisMock.set.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-2'));
    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));

    expect(redisMock.set).toHaveBeenCalledTimes(3);
    expect((guild.channels.cache.get('text-1') as unknown as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledTimes(1);
    expect((guild.channels.cache.get('text-2') as unknown as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledTimes(1);
    expect(redisMock.set).toHaveBeenNthCalledWith(
      1,
      'vc-capacity-notice:guild-1:voice-1',
      '1',
      'EX',
      30,
      'NX',
    );
    expect(redisMock.set).toHaveBeenNthCalledWith(
      2,
      'vc-capacity-notice:guild-1:voice-2',
      '1',
      'EX',
      30,
      'NX',
    );
  });
});
