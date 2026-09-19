import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  configState,
  mockApplicationCommands,
  mockApplicationGuildCommands,
  mockGet,
  mockPut,
  mockRest,
  mockWarn,
} = vi.hoisted(() => ({
  configState: {
    botInstanceId: 2,
    discordToken: 'token-2',
    discordClientId: 'client-2',
    deployGuildId: undefined as string | undefined,
    botAdminUserIds: ['admin-1', 'admin-2'],
  },
  mockApplicationCommands: vi.fn(),
  mockApplicationGuildCommands: vi.fn(),
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockRest: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('discord.js', () => ({
  REST: mockRest,
  Routes: {
    applicationCommands: mockApplicationCommands,
    applicationGuildCommands: mockApplicationGuildCommands,
  },
}));

vi.mock('../config.js', () => ({ config: configState }));

vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: mockWarn,
  },
}));

import { cleanupSubBotCommands } from '../cleanup-sub-bot-commands.js';

type CleanupClient = Parameters<typeof cleanupSubBotCommands>[0];

function createClient(): {
  client: CleanupClient;
  fetch: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
} {
  const send = vi.fn().mockResolvedValue(undefined);
  const fetch = vi.fn().mockResolvedValue({ send });

  return {
    client: { users: { fetch } } as unknown as CleanupClient,
    fetch,
    send,
  };
}

describe('cleanupSubBotCommands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configState.botInstanceId = 2;
    configState.deployGuildId = undefined;
    configState.botAdminUserIds = ['admin-1', 'admin-2'];
    mockApplicationCommands.mockReturnValue('global-commands-route');
    mockApplicationGuildCommands.mockReturnValue('guild-commands-route');
    mockGet.mockResolvedValue([]);
    mockPut.mockResolvedValue([]);
    mockRest.mockImplementation(() => ({
      setToken: vi.fn().mockReturnThis(),
      get: mockGet,
      put: mockPut,
    }));
  });

  it('Bot 1ではDiscord APIへアクセスしない', async () => {
    configState.botInstanceId = 1;
    const { client, fetch } = createClient();

    await cleanupSubBotCommands(client, 0);

    expect(mockRest).not.toHaveBeenCalled();
    expect(mockApplicationCommands).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('サブBotの非ゼロシャードではDiscord APIへアクセスしない', async () => {
    const { client, fetch } = createClient();

    await cleanupSubBotCommands(client, 1);

    expect(mockRest).not.toHaveBeenCalled();
    expect(mockApplicationCommands).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('コマンドが0件ならGETだけを実行し、PUTとDMを実行しない', async () => {
    const { client, fetch } = createClient();

    await cleanupSubBotCommands(client, 0);

    expect(mockApplicationCommands).toHaveBeenCalledWith('client-2');
    expect(mockGet).toHaveBeenCalledWith('global-commands-route');
    expect(mockPut).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('グローバルコマンドが存在する場合だけPUTで空配列を送る', async () => {
    mockGet.mockResolvedValue([{ id: 'command-1' }]);
    const { client, fetch } = createClient();

    await cleanupSubBotCommands(client, 0);

    expect(mockGet).toHaveBeenCalledWith('global-commands-route');
    expect(mockPut).toHaveBeenCalledWith('global-commands-route', { body: [] });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('DEPLOY_GUILD_ID設定時はギルドコマンドの経路だけを対象にする', async () => {
    configState.deployGuildId = 'guild-1';
    mockGet.mockResolvedValue([{ id: 'command-1' }]);
    const { client } = createClient();

    await cleanupSubBotCommands(client, 0);

    expect(mockApplicationGuildCommands).toHaveBeenCalledWith('client-2', 'guild-1');
    expect(mockGet).toHaveBeenCalledWith('guild-commands-route');
    expect(mockPut).toHaveBeenCalledWith('guild-commands-route', { body: [] });
    expect(mockApplicationCommands).not.toHaveBeenCalled();
  });

  it('GET失敗時は起動を妨げず、全管理者へDMを試みる', async () => {
    mockGet.mockRejectedValue(new Error('GET failed'));
    const { client, fetch, send } = createClient();

    await expect(cleanupSubBotCommands(client, 0)).resolves.toBeUndefined();

    expect(mockPut).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, 'admin-1');
    expect(fetch).toHaveBeenNthCalledWith(2, 'admin-2');
    expect(send).toHaveBeenCalledWith(expect.stringContaining('インスタンスID: 2'));
    expect(send).toHaveBeenCalledWith(expect.stringContaining('GET failed'));
  });

  it('PUT失敗時もDM失敗を記録しながら他の管理者へ通知する', async () => {
    mockGet.mockResolvedValue([{ id: 'command-1' }]);
    mockPut.mockRejectedValue(new Error('PUT failed'));
    const secondAdminSend = vi.fn().mockResolvedValue(undefined);
    const { client, fetch } = createClient();
    fetch
      .mockRejectedValueOnce(new Error('DM fetch failed'))
      .mockResolvedValueOnce({ send: secondAdminSend });

    await expect(cleanupSubBotCommands(client, 0)).resolves.toBeUndefined();

    expect(mockPut).toHaveBeenCalledWith('global-commands-route', { body: [] });
    expect(secondAdminSend).toHaveBeenCalledWith(expect.stringContaining('PUT failed'));
    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'admin-1', instanceId: 2 }),
      expect.stringContaining('Failed to notify bot administrator'),
    );
  });

  it('同じクライアントではクリーンアップを重複実行しない', async () => {
    const { client } = createClient();

    await cleanupSubBotCommands(client, 0);
    await cleanupSubBotCommands(client, 0);

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPut).not.toHaveBeenCalled();
  });
});
