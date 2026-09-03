import { useState, useEffect, useCallback } from 'react';
import { Button, Checkbox, Modal, Switch, Select, ListBox } from '@heroui/react';
import { RefreshCw } from 'lucide-react';
import { useParams } from 'react-router';
import type {
  AutoJoinChannelPair,
  BotInstanceSettings,
  ResolvedBotInstanceSettings,
} from '@sumirevox/shared';
import { api, ApiError } from '../../lib/api';
import { Toast, useToast } from '../../components/toast';
import {
  appendChannelPair,
  applyBotSettingsPatch,
  canAddChannelPair,
  createEmptyBotInstanceSettings,
  getAvailableVoiceChannelIds,
  getCopyableBotInfos,
  removeChannelPair,
  updateChannelPair,
} from './server-bots-helpers';

interface BotInstanceInfo {
  instanceNumber: number;
  name: string;
  botUserId: string;
  isActive: boolean;
  isInGuild: boolean;
  isAvailable: boolean;
  settings: ResolvedBotInstanceSettings | null;
}

interface BotListResponse {
  bots: BotInstanceInfo[];
  boostCount: number;
  maxBots: number;
  autoJoinSettings: ResolvedBotInstanceSettings;
  botInstancePriority: number[];
}

interface Channel {
  id: string;
  name: string;
  parentId: string | null;
  type: 'text' | 'announcement' | 'voice' | 'stage';
}

interface Category {
  id: string;
  name: string;
}

interface ChannelsData {
  textChannels: Channel[];
  voiceChannels: Channel[];
  readableChannels: Channel[];
  categories: Category[];
}

interface PairDraft {
  instanceNumber: number;
  voiceChannelId: string;
  textChannelId: string;
}

type CopyStep = 'select' | 'confirm';

function StatusBadge({ label, variant }: { label: string; variant: 'active' | 'inactive' | 'unavailable' }) {
  const styles = {
    active: 'bg-green-500/20 text-green-400',
    inactive: 'bg-yellow-500/20 text-yellow-400',
    unavailable: 'bg-white/10 text-gray-500',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${styles[variant]}`}>
      {label}
    </span>
  );
}

function channelLabel(ch: Channel, categories: Category[]): string {
  if (ch.parentId) {
    const cat = categories.find((c) => c.id === ch.parentId);
    if (cat) return `${cat.name} > ${ch.name}`;
  }
  return ch.name;
}

function channelTypeLabel(type: Channel['type']): { prefix: string; label: string } {
  switch (type) {
    case 'text':
      return { prefix: '#', label: 'テキスト' };
    case 'announcement':
      return { prefix: '📣', label: 'アナウンス' };
    case 'voice':
      return { prefix: '🔊', label: 'ボイス' };
    case 'stage':
      return { prefix: '🎙', label: 'ステージ' };
  }
}

function channelDisplayLabel(ch: Channel, categories: Category[]): string {
  const type = channelTypeLabel(ch.type);
  const category = ch.parentId ? categories.find((c) => c.id === ch.parentId) : undefined;
  const name = category ? `${category.name} > ${type.prefix} ${ch.name}` : `${type.prefix} ${ch.name}`;
  return `${name}（${type.label}）`;
}

function ChannelSelect({
  label,
  value,
  channels,
  categories,
  placeholder,
  disabled,
  showChannelType = false,
  onChange,
}: {
  label: string;
  value: string;
  channels: Channel[];
  categories: Category[];
  placeholder: string;
  disabled?: boolean;
  showChannelType?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-xs text-gray-500">{label}</label>
      <Select
        aria-label={label}
        value={value}
        onChange={(selected) => onChange((selected as string) || '')}
        isDisabled={disabled}
      >
        <Select.Trigger className="w-full bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          <Select.Value>{value ? undefined : placeholder}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl max-h-60 overflow-y-auto">
          <ListBox>
            {channels.map((channel) => (
              <ListBox.Item
                key={channel.id}
                id={channel.id}
                textValue={showChannelType ? channelDisplayLabel(channel, categories) : channelLabel(channel, categories)}
              >
                {showChannelType ? channelDisplayLabel(channel, categories) : channelLabel(channel, categories)}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

function PairSummary({
  pair,
  index,
  channels,
  categories,
}: {
  pair: AutoJoinChannelPair;
  index: number;
  channels: ChannelsData | null;
  categories: Category[];
}) {
  const voiceChannel = channels?.voiceChannels.find((channel) => channel.id === pair.voiceChannelId);
  const textChannel = channels?.readableChannels.find((channel) => channel.id === pair.textChannelId);
  return (
    <span className="text-xs text-gray-400 truncate min-w-0">
      ペア {index + 1}: {voiceChannel ? channelDisplayLabel(voiceChannel, categories) : pair.voiceChannelId}
      {' → '}
      {textChannel ? channelDisplayLabel(textChannel, categories) : pair.textChannelId}
    </span>
  );
}

export function ServerBotsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [data, setData] = useState<BotListResponse | null>(null);
  const [channels, setChannels] = useState<ChannelsData | null>(null);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [pairDraft, setPairDraft] = useState<PairDraft | null>(null);
  const [copySource, setCopySource] = useState<BotInstanceInfo | null>(null);
  const [copyTargetIds, setCopyTargetIds] = useState<number[]>([]);
  const [copyStep, setCopyStep] = useState<CopyStep>('select');
  const [copyLoading, setCopyLoading] = useState(false);
  const { toastState, showSaving, showSuccess, showError } = useToast();

  const fetchBots = useCallback(async (signal?: AbortSignal): Promise<BotListResponse> => {
    if (!guildId) throw new Error('Guild ID is missing');
    const result = await api.get<BotListResponse>(`/api/guilds/${guildId}/bots`, signal ? { signal } : undefined);
    setData(result);
    return result;
  }, [guildId]);

  const fetchChannels = useCallback(async (
    signal?: AbortSignal,
    forceRefresh = false,
  ): Promise<ChannelsData | null> => {
    if (!guildId) return null;

    setChannelsLoading(true);
    setChannelsError(null);
    try {
      const result = forceRefresh
        ? await api.post<ChannelsData>(`/api/guilds/${guildId}/channels/refresh`)
        : await api.get<ChannelsData>(
            `/api/guilds/${guildId}/channels`,
            signal ? { signal } : undefined,
          );
      if (!signal?.aborted) setChannels(result);
      return result;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      if (!signal?.aborted) {
        if (!forceRefresh) setChannels(null);
        setChannelsError(
          err instanceof ApiError ? err.message : 'チャンネル一覧の読み込みに失敗しました。',
        );
      }
      return null;
    } finally {
      if (!signal?.aborted) setChannelsLoading(false);
    }
  }, [guildId]);

  const refreshChannels = useCallback(async () => {
    const result = await fetchChannels(undefined, true);
    if (result) showSuccess('チャンネル一覧を更新しました');
  }, [fetchChannels, showSuccess]);

  useEffect(() => {
    if (!guildId) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);
    setData(null);
    setChannels(null);
    setChannelsError(null);

    const load = async () => {
      try {
        const [botData] = await Promise.all([
          fetchBots(controller.signal),
          fetchChannels(controller.signal),
        ]);
        if (!controller.signal.aborted) {
          setData(botData);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setLoadError(err instanceof ApiError ? err.message : 'Bot 情報の読み込みに失敗しました。');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [fetchBots, fetchChannels, guildId]);

  const updateSettings = useCallback(
    async (instanceNumber: number, patch: Partial<BotInstanceSettings>): Promise<boolean> => {
      if (!guildId) return false;
      setSavingId(instanceNumber);
      showSaving();
      try {
        await api.put(`/api/guilds/${guildId}/auto-join-settings`, patch);
        setData((previous) => {
          if (!previous) return previous;
          return {
            ...previous,
            autoJoinSettings: applyBotSettingsPatch(previous.autoJoinSettings, patch),
            bots: previous.bots.map((bot) => {
              const currentSettings = bot.settings ?? createEmptyBotInstanceSettings();
              return {
                ...bot,
                settings: applyBotSettingsPatch(currentSettings, patch),
              };
            }),
          };
        });
        showSuccess();
        return true;
      } catch (err) {
        showError(err instanceof ApiError ? err.message : '保存に失敗しました');
        if (!(err instanceof ApiError)) throw err;
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [guildId, showSaving, showSuccess, showError],
  );

  const handleInvite = useCallback(
    async (instanceNumber: number) => {
      if (!guildId) return;
      try {
        const result = await api.get<{ url: string }>(
          `/api/guilds/${guildId}/bots/${instanceNumber}/invite`,
        );
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        showError(err instanceof ApiError ? err.message : '招待URLの取得に失敗しました');
        if (!(err instanceof ApiError)) throw err;
      }
    },
    [guildId, showError],
  );

  const updatePriority = useCallback(async (instanceIds: number[]) => {
    if (!guildId) return;
    try {
      await api.put(`/api/guilds/${guildId}/bot-priority`, { instanceIds });
      setData((previous) => previous ? { ...previous, botInstancePriority: instanceIds } : previous);
      showSuccess('Bot接続優先順位を更新しました');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : '優先順位の保存に失敗しました');
    }
  }, [guildId, showError, showSuccess]);

  const movePriority = (index: number, direction: -1 | 1) => {
    if (!data) return;
    const target = index + direction;
    if (target < 0 || target >= data.botInstancePriority.length) return;
    const instanceIds = [...data.botInstancePriority];
    [instanceIds[index], instanceIds[target]] = [instanceIds[target]!, instanceIds[index]!];
    void updatePriority(instanceIds);
  };

  const openPairModal = (bot: BotInstanceInfo) => {
    setPairDraft({ instanceNumber: bot.instanceNumber, voiceChannelId: '', textChannelId: '' });
  };

  const closePairModal = () => {
    if (pairDraft && savingId === pairDraft.instanceNumber) return;
    setPairDraft(null);
  };

  const handleAddPair = async () => {
    if (!pairDraft || !data) return;
    const bot = data.bots.find((item) => item.instanceNumber === pairDraft.instanceNumber);
    if (!bot) return;
    const settings = bot.settings ?? createEmptyBotInstanceSettings();
    const nextPairs = appendChannelPair(settings.channelPairs, pairDraft);
    if (!nextPairs) {
      showError('VCとテキストチャンネルを選択し、VCが重複しないようにしてください');
      return;
    }

    const saved = await updateSettings(bot.instanceNumber, { channelPairs: nextPairs });
    if (saved) setPairDraft(null);
  };

  const openCopyModal = (bot: BotInstanceInfo) => {
    if (!data) return;
    const candidates = getCopyableBotInfos(data.bots, bot.instanceNumber);
    if (candidates.length === 0) {
      showError('コピー先に選択できるBotがありません');
      return;
    }
    setCopySource(bot);
    setCopyTargetIds([]);
    setCopyStep('select');
  };

  const closeCopyModal = () => {
    if (copyLoading) return;
    setCopySource(null);
    setCopyTargetIds([]);
    setCopyStep('select');
  };

  const toggleCopyTarget = (instanceNumber: number, selected: boolean) => {
    setCopyTargetIds((current) => {
      if (selected) return current.includes(instanceNumber) ? current : [...current, instanceNumber];
      return current.filter((id) => id !== instanceNumber);
    });
  };

  const handleCopy = async () => {
    if (!guildId || !copySource || copyTargetIds.length === 0) return;
    setCopyLoading(true);
    showSaving('コピー中…');
    try {
      await api.post(`/api/guilds/${guildId}/bots/${copySource.instanceNumber}/settings/copy`, {
        targetInstanceIds: copyTargetIds,
      });
      await fetchBots();
      setCopySource(null);
      setCopyTargetIds([]);
      setCopyStep('select');
      showSuccess('設定をコピーしました');
    } catch (err) {
      showError(err instanceof ApiError ? err.message : '設定のコピーに失敗しました');
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setCopyLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-red-400">{loadError ?? 'Bot 情報の読み込みに失敗しました。'}</p>;

  const totalInstances = data.bots.length;
  const effectiveMaxBots = Math.min(data.maxBots, totalInstances);
  const categories = channels?.categories ?? [];
  const readableChannels = channels?.readableChannels ?? [];
  const voiceChannels = channels?.voiceChannels ?? [];
  const copyCandidates = copySource ? getCopyableBotInfos(data.bots, copySource.instanceNumber) : [];
  const pairModalBot = pairDraft
    ? data.bots.find((bot) => bot.instanceNumber === pairDraft.instanceNumber)
    : undefined;
  const pairModalSettings = pairModalBot?.settings ?? createEmptyBotInstanceSettings();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Bot 管理</h1>
          <p className="text-gray-400">サーバーで利用可能な Bot の管理と設定ができます。</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <span className="text-sm bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-xl font-medium">
            利用可能な Bot 数: {effectiveMaxBots} / {totalInstances}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => void refreshChannels()}
            isPending={channelsLoading}
            isDisabled={channelsLoading}
            className="border border-white/20 bg-white/5 text-white"
          >
            <RefreshCw className={`w-4 h-4 ${channelsLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {channelsLoading ? '更新中...' : 'チャンネルを更新'}
          </Button>
        </div>
      </div>

      {channelsError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
        >
          <span>チャンネル候補を取得できませんでした。{channelsError}</span>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => void refreshChannels()}
            isDisabled={channelsLoading}
            className="border border-amber-400/40 bg-transparent text-amber-100 shrink-0"
          >
            再試行
          </Button>
        </div>
      )}

      <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Bot接続優先順位</h2>
          <p className="text-xs text-gray-500 mt-1">上から順に空いているBotを割り当てます。現在のBoost枠内のBotを強調表示します。</p>
        </div>
        {data.botInstancePriority.map((instanceId, index) => {
          const bot = data.bots.find((item) => item.instanceNumber === instanceId);
          if (!bot) return null;
          return (
            <div key={instanceId} className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-3 py-2">
              <span className="text-sm text-purple-300 w-6">{index + 1}</span>
              <span className="text-sm text-white flex-1">{bot.name}</span>
              <StatusBadge label={bot.isAvailable ? '利用可能' : 'Boost枠外'} variant={bot.isAvailable ? 'active' : 'unavailable'} />
              <Button size="sm" variant="secondary" isDisabled={index === 0} onPress={() => movePriority(index, -1)}>↑</Button>
              <Button size="sm" variant="secondary" isDisabled={index === data.botInstancePriority.length - 1} onPress={() => movePriority(index, 1)}>↓</Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        {data.bots.filter((bot) => bot.instanceNumber === data.botInstancePriority[0]).map((bot) => {
          const isSaving = savingId === bot.instanceNumber;

          if (!bot.isAvailable) {
            return (
              <div
                key={bot.instanceNumber}
                className="bg-[#12121a] border border-white/5 rounded-2xl p-6 opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">{bot.name}</span>
                  <StatusBadge label="利用不可" variant="unavailable" />
                </div>
                <p className="text-sm text-gray-500 mt-2">このインスタンスを利用するにはブーストが必要です。</p>
              </div>
            );
          }

          const settings = bot.settings ?? createEmptyBotInstanceSettings();
          const usedVoiceChannelIds = getAvailableVoiceChannelIds(settings.channelPairs);
          const canCopy = false;

          return (
            <div
              key={bot.instanceNumber}
              className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-5"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <span className="text-white font-semibold">{bot.name}</span>
                  <p className="text-xs text-gray-500 mt-1">Bot インスタンス #{bot.instanceNumber}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {canCopy && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => openCopyModal(bot)}
                      isDisabled={copyLoading}
                      className="border border-white/20 bg-white/5 text-white"
                    >
                      設定をコピー
                    </Button>
                  )}
                  <StatusBadge
                    label={bot.isActive ? '稼働中' : '停止中'}
                    variant={bot.isActive ? 'active' : 'inactive'}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">ステータス</span>
                {bot.isInGuild ? (
                  <span className="text-green-400">サーバーに参加済み</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">未参加</span>
                    <button
                      onClick={() => void handleInvite(bot.instanceNumber)}
                      className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-40"
                      disabled={isSaving}
                    >
                      サーバーに招待
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-white">自動接続</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {bot.isInGuild
                        ? '誰かが VC に参加したとき、登録したペアへ自動で接続する'
                        : '参加後に設定可能'}
                    </p>
                  </div>
                  <Switch
                    aria-label={`${bot.name}の自動接続`}
                    isSelected={settings.autoJoin}
                    isDisabled={!bot.isInGuild || isSaving}
                    onChange={(selected) => void updateSettings(bot.instanceNumber, { autoJoin: selected })}
                  >
                    {({ isSelected }) => (
                      <Switch.Control className={isSelected ? 'bg-purple-600' : 'bg-white/20'}>
                        <Switch.Thumb />
                      </Switch.Control>
                    )}
                  </Switch>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">自動接続ペア</p>
                      <p className="text-xs text-gray-500 mt-0.5">VCごとに読み上げ対象のチャンネルを指定します。</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onPress={() => openPairModal(bot)}
                      isDisabled={
                        !bot.isInGuild ||
                        isSaving ||
                        channelsLoading ||
                        voiceChannels.every((channel) => usedVoiceChannelIds.has(channel.id))
                      }
                      className="border border-white/20 bg-white/5 text-white shrink-0"
                    >
                      ペアを追加
                    </Button>
                  </div>

                  {settings.channelPairs.length === 0 ? (
                    <p className="text-sm text-gray-500 rounded-xl border border-dashed border-white/10 px-4 py-3">
                      自動接続ペアがありません。
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {settings.channelPairs.map((pair, pairIndex) => {
                        const otherVoiceIds = new Set(
                          settings.channelPairs
                            .filter((_, index) => index !== pairIndex)
                            .map((item) => item.voiceChannelId),
                        );
                        const pairVoiceChannels = voiceChannels.filter(
                          (channel) => !otherVoiceIds.has(channel.id),
                        );

                        return (
                          <div
                            key={`${pair.voiceChannelId}-${pairIndex}`}
                            className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex flex-col gap-3"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <PairSummary
                                pair={pair}
                                index={pairIndex}
                                channels={channels}
                                categories={categories}
                              />
                              <button
                                type="button"
                                aria-label={`ペア${pairIndex + 1}を削除`}
                                onClick={() => void updateSettings(
                                  bot.instanceNumber,
                                  { channelPairs: removeChannelPair(settings.channelPairs, pairIndex) },
                                )}
                                disabled={!bot.isInGuild || isSaving}
                                className="text-xs text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                              >
                                削除
                              </button>
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              <ChannelSelect
                                label="VC チャンネル"
                                value={pair.voiceChannelId}
                                channels={pairVoiceChannels}
                                categories={categories}
                                placeholder="VC チャンネルを選択"
                                disabled={!bot.isInGuild || isSaving}
                                showChannelType
                                onChange={(value) => void updateSettings(
                                  bot.instanceNumber,
                                  {
                                    channelPairs: updateChannelPair(settings.channelPairs, pairIndex, {
                                      voiceChannelId: value,
                                    }),
                                  },
                                )}
                              />
                              <ChannelSelect
                                label="読み上げ対象チャンネル"
                                value={pair.textChannelId}
                                channels={readableChannels}
                                categories={categories}
                                placeholder="テキストチャンネルを選択"
                                disabled={!bot.isInGuild || isSaving}
                                showChannelType
                                onChange={(value) => void updateSettings(
                                  bot.instanceNumber,
                                  {
                                    channelPairs: updateChannelPair(settings.channelPairs, pairIndex, {
                                      textChannelId: value,
                                    }),
                                  },
                                )}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {settings.autoJoin && settings.channelPairs.length === 0 && (
                    <p className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                      自動接続が有効ですが、接続先のペアが登録されていません。ペアを追加してください。
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal>
        <Modal.Backdrop isOpen={pairDraft !== null} onOpenChange={(open) => { if (!open) closePairModal(); }}>
          <Modal.Container>
            <Modal.Dialog className="bg-[#1a1a2e] border border-white/10 max-w-xl">
              <Modal.Header>
                <Modal.Heading className="text-white">自動接続ペアを追加</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4">
                <p className="text-sm text-gray-400">VCと読み上げ対象チャンネルを両方選択してください。</p>
                <ChannelSelect
                  label="VC チャンネル"
                  value={pairDraft?.voiceChannelId ?? ''}
                  channels={voiceChannels.filter((channel) => !getAvailableVoiceChannelIds(pairModalSettings.channelPairs).has(channel.id))}
                  categories={categories}
                  placeholder="VC チャンネルを選択"
                  disabled={pairDraft === null || savingId === pairDraft.instanceNumber}
                  showChannelType
                  onChange={(value) => setPairDraft((current) => current ? { ...current, voiceChannelId: value } : current)}
                />
                <ChannelSelect
                  label="読み上げ対象チャンネル"
                  value={pairDraft?.textChannelId ?? ''}
                  channels={readableChannels}
                  categories={categories}
                  placeholder="テキストチャンネルを選択"
                  disabled={pairDraft === null || savingId === pairDraft.instanceNumber}
                  showChannelType
                  onChange={(value) => setPairDraft((current) => current ? { ...current, textChannelId: value } : current)}
                />
              </Modal.Body>
              <Modal.Footer className="border-t border-white/5">
                <Button
                  variant="secondary"
                  onPress={closePairModal}
                  isDisabled={pairDraft !== null && savingId === pairDraft.instanceNumber}
                  className="border border-white/20 bg-white/5 text-white"
                >
                  キャンセル
                </Button>
                <Button
                  className="gradient-bg text-white"
                  onPress={() => void handleAddPair()}
                  isPending={pairDraft !== null && savingId === pairDraft.instanceNumber}
                  isDisabled={!pairDraft || !canAddChannelPair(pairModalSettings.channelPairs, pairDraft)}
                >
                  追加
                </Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal>
        <Modal.Backdrop isOpen={copySource !== null} onOpenChange={(open) => { if (!open) closeCopyModal(); }}>
          <Modal.Container>
            <Modal.Dialog className="bg-[#1a1a2e] border border-white/10 max-w-xl">
              <Modal.Header>
                <Modal.Heading className="text-white">
                  {copyStep === 'select' ? '設定のコピー先を選択' : '設定の上書きを確認'}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-4 max-h-[65vh] overflow-y-auto">
                {copySource && copyStep === 'select' && (
                  <>
                    <p className="text-sm text-gray-400">
                      {copySource.name} の自動接続設定をコピーします。コピー先の既存設定は上書きされます。
                    </p>
                    <div className="flex flex-col gap-2">
                      {copyCandidates.map((candidate) => (
                        <Checkbox
                          key={candidate.instanceNumber}
                          isSelected={copyTargetIds.includes(candidate.instanceNumber)}
                          onChange={(selected) => toggleCopyTarget(candidate.instanceNumber, selected)}
                          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-white"
                        >
                          <Checkbox.Control className="border-white/30 data-[selected=true]:bg-purple-600">
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <Checkbox.Content>
                            <span className="flex flex-col">
                              <span>{candidate.name}</span>
                              <span className="text-xs text-gray-500">
                                {candidate.isAvailable ? '利用可能' : 'ブースト枠外（設定保存可）'}
                              </span>
                            </span>
                          </Checkbox.Content>
                        </Checkbox>
                      ))}
                    </div>
                  </>
                )}

                {copySource && copyStep === 'confirm' && (
                  <div className="flex flex-col gap-4">
                    <p className="text-sm text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                      選択したBotの自動接続設定を、{copySource.name} の設定で上書きします。この操作は取り消せません。
                    </p>
                    <div className="flex flex-col gap-2">
                      {copyCandidates
                        .filter((candidate) => copyTargetIds.includes(candidate.instanceNumber))
                        .map((candidate) => (
                          <div key={candidate.instanceNumber} className="flex items-center justify-between text-sm">
                            <span className="text-white">{candidate.name}</span>
                            <span className="text-gray-500">上書き対象</span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </Modal.Body>
              <Modal.Footer className="border-t border-white/5">
                {copyStep === 'select' ? (
                  <>
                    <Button
                      variant="secondary"
                      onPress={closeCopyModal}
                      className="border border-white/20 bg-white/5 text-white"
                    >
                      キャンセル
                    </Button>
                    <Button
                      className="gradient-bg text-white"
                      onPress={() => setCopyStep('confirm')}
                      isDisabled={copyTargetIds.length === 0}
                    >
                      確認へ
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      onPress={() => setCopyStep('select')}
                      isDisabled={copyLoading}
                      className="border border-white/20 bg-white/5 text-white"
                    >
                      戻る
                    </Button>
                    <Button
                      className="bg-purple-600 text-white"
                      onPress={() => void handleCopy()}
                      isPending={copyLoading}
                      isDisabled={copyTargetIds.length === 0}
                    >
                      上書きしてコピー
                    </Button>
                  </>
                )}
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Toast state={toastState} />
    </div>
  );
}
