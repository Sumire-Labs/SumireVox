import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageFlags } from 'discord.js';

const { inspectMock, allocateMock } = vi.hoisted(() => ({
  inspectMock: vi.fn(),
  allocateMock: vi.fn(),
}));

vi.mock('../../services/vc-allocation-service.js', () => ({
  inspectVoiceConnectionAllocation: inspectMock,
  allocateVoiceConnection: allocateMock,
}));

vi.mock('../../infrastructure/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}));

import { joinCommand } from '../join.js';

function makeInteraction() {
  return {
    inGuild: vi.fn(() => true),
    guildId: 'guild-1',
    channelId: 'text-1',
    member: {
      voice: {
        channel: { id: 'voice-2' },
      },
    },
    reply: vi.fn(),
    deferReply: vi.fn(),
    editReply: vi.fn(),
    followUp: vi.fn(),
  } as unknown as Parameters<typeof joinCommand.execute>[0];
}

describe('/join allocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inspectMock.mockResolvedValue({ status: 'candidate', instanceId: 2 });
    allocateMock.mockResolvedValue({ status: 'connected', instanceId: 2 });
  });

  it('Bot 1が別VCを使用中でも、空きサブBotへ接続を委譲する', async () => {
    const interaction = makeInteraction();

    await joinCommand.execute(interaction);

    expect(allocateMock).toHaveBeenCalledWith({
      guildId: 'guild-1',
      voiceChannelId: 'voice-2',
      textChannelId: 'text-1',
      connectionMode: 'manual',
      existingOwnerBehavior: 'update',
    });
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '<#voice-2> に接続しました。<#text-1> のメッセージを読み上げます。',
    });
  });

  it('対象VCの既存所有者がいる場合は読み上げチャンネル変更として応答する', async () => {
    inspectMock.mockResolvedValue({ status: 'existing', instanceId: 3 });
    allocateMock.mockResolvedValue({ status: 'updated', instanceId: 3 });
    const interaction = makeInteraction();

    await joinCommand.execute(interaction);

    expect(allocateMock).toHaveBeenCalledWith(expect.objectContaining({
      connectionMode: 'manual',
      existingOwnerBehavior: 'update',
    }));
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: '読み上げチャンネルを <#text-1> に変更しました。',
    });
  });

  it('全候補使用中はInteractionへEphemeralで通知する', async () => {
    inspectMock.mockResolvedValue({ status: 'capacity' });
    const interaction = makeInteraction();

    await joinCommand.execute(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: '利用可能なBotがすべて別のVCで使用中です。',
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(allocateMock).not.toHaveBeenCalled();
  });
});
