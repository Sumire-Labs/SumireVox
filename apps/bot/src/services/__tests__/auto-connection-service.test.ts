import type { GuildSettings, ResolvedBotInstanceSettings, VcSession } from '@sumirevox/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../infrastructure/discord-client.js', () => ({
  getClient: vi.fn(),
}));

vi.mock('../../infrastructure/config.js', () => ({
  config: {
    botInstanceId: 2,
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
}));

vi.mock('../vc-session-manager.js', () => ({
  createVcSession: vi.fn(),
  destroyVcSession: vi.fn(),
  getAllVcSessions: vi.fn(),
  getVcSession: vi.fn(),
  moveVcSession: vi.fn(),
}));

vi.mock('../premium-service.js', () => ({
  canInstanceConnect: vi.fn(),
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
import { getGuildSettings, getInstanceSettings } from '../guild-settings-service.js';
import {
  createVcSession,
  destroyVcSession,
  getAllVcSessions,
  getVcSession,
  moveVcSession,
} from '../vc-session-manager.js';
import { canInstanceConnect } from '../premium-service.js';
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
const mockCreateVcSession = vi.mocked(createVcSession);
const mockDestroyVcSession = vi.mocked(destroyVcSession);
const mockGetAllVcSessions = vi.mocked(getAllVcSessions);
const mockGetVcSession = vi.mocked(getVcSession);
const mockMoveVcSession = vi.mocked(moveVcSession);
const mockCanInstanceConnect = vi.mocked(canInstanceConnect);
const mockCancelDisconnectTimer = vi.mocked(cancelDisconnectTimer);
const mockStartDisconnectTimer = vi.mocked(startDisconnectTimer);
const mockGetPredefinedAudio = vi.mocked(getPredefinedAudio);
const mockEnqueuePreSynthesized = vi.mocked(enqueuePreSynthesized);

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
  return { id, isTextBased: () => true, isVoiceBased: () => false };
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
    mockGetVcSession.mockReturnValue(undefined);
    mockGetAllVcSessions.mockReturnValue(new Map());
    mockCanInstanceConnect.mockResolvedValue(true);
    mockGetPredefinedAudio.mockResolvedValue(null);
    mockGetClient.mockReturnValue({ guilds: { cache: { get: vi.fn() } } } as unknown as ReturnType<typeof getClient>);
  });

  it('対象VCの参加だけをペア対応TCで自動接続する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
      'voice-2': makeVoiceChannel('voice-2', 1),
      'text-2': makeTextChannel('text-2'),
    });
    mockCreateVcSession.mockResolvedValue(makeSession({ voiceChannelId: 'voice-2', textChannelId: 'text-2' }));

    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-2'));

    expect(mockCreateVcSession).toHaveBeenCalledWith(
      'guild-1',
      'voice-2',
      'text-2',
      guild.voiceAdapterCreator,
      'auto',
    );
    expect(mockCanInstanceConnect).toHaveBeenCalledWith('guild-1', 2);
  });

  it('対象外VC、権限不足、Premium不足では接続しない', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1, false),
      'text-1': makeTextChannel('text-1'),
    });

    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'other-voice'));
    expect(mockCreateVcSession).not.toHaveBeenCalled();

    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    expect(mockCreateVcSession).not.toHaveBeenCalled();

    mockCanInstanceConnect.mockResolvedValue(false);
    const allowedGuild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
    });
    await handleAutoJoinVoiceState(makeState(allowedGuild, null), makeState(allowedGuild, 'voice-1'));
    expect(mockCreateVcSession).not.toHaveBeenCalled();
  });

  it('同時の自動接続イベントは1つの接続処理へ直列化する', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
    });
    let resolveCreate: (session: VcSession) => void = () => {};
    let currentSession: VcSession | undefined;
    const createPromise = new Promise<VcSession>((resolve) => {
      resolveCreate = resolve;
    });
    mockCreateVcSession.mockImplementation(async () => {
      const session = await createPromise;
      currentSession = session;
      return session;
    });
    mockGetVcSession.mockImplementation(() => currentSession);

    const first = handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    const second = handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    await vi.waitFor(() => expect(mockCreateVcSession).toHaveBeenCalledTimes(1));

    resolveCreate(makeSession());
    await Promise.all([first, second]);
    expect(mockCreateVcSession).toHaveBeenCalledTimes(1);
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
    mockGetInstanceSettings.mockReturnValue(
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
    mockGetInstanceSettings.mockReturnValue(
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
    mockGetInstanceSettings.mockReturnValue(
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

  it('自動接続時だけ挨拶し、切り替え時は挨拶しない', async () => {
    const guild = makeGuild({
      'voice-1': makeVoiceChannel('voice-1', 1),
      'text-1': makeTextChannel('text-1'),
    });
    mockGetGuildSettings.mockResolvedValue({ ...makeSettings(), greetingOnJoin: true });
    mockGetPredefinedAudio.mockResolvedValue(Buffer.from('audio'));
    const createdSession = makeSession();
    mockCreateVcSession.mockImplementation(async () => {
      mockGetVcSession.mockReturnValue(createdSession);
      return createdSession;
    });

    await handleAutoJoinVoiceState(makeState(guild, null), makeState(guild, 'voice-1'));
    expect(mockEnqueuePreSynthesized).toHaveBeenCalledWith('guild-1', expect.any(Buffer));

    vi.clearAllMocks();
    mockGetVcSession.mockReturnValue(makeSession());
    mockGetClient.mockReturnValue({
      guilds: { cache: { get: () => guild } },
    } as unknown as ReturnType<typeof getClient>);
    await handleAutoDisconnectTimerExpired('guild-1');
    expect(mockEnqueuePreSynthesized).not.toHaveBeenCalled();
  });
});
