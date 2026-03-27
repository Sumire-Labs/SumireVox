import { useState, useEffect, useCallback } from 'react';
import { Switch, Select, ListBox } from '@heroui/react';
import { useParams } from 'react-router';
import { api, ApiError } from '../../lib/api';
import { Toast, useToast } from '../../components/toast';

interface BotInstanceSettings {
  autoJoin: boolean;
  textChannelId: string | null;
  voiceChannelId: string | null;
}

interface BotInstanceInfo {
  instanceNumber: number;
  name: string;
  botUserId: string;
  isActive: boolean;
  isInGuild: boolean;
  isAvailable: boolean;
  settings: BotInstanceSettings | null;
}

interface BotListResponse {
  bots: BotInstanceInfo[];
  boostCount: number;
  maxBots: number;
}

interface Channel {
  id: string;
  name: string;
  parentId: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface ChannelsData {
  textChannels: Channel[];
  voiceChannels: Channel[];
  categories: Category[];
}

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

function ChannelSelect({
  label,
  value,
  channels,
  categories,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  channels: Channel[];
  categories: Category[];
  placeholder: string;
  disabled?: boolean;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-500">{label}</label>
      <Select
        aria-label={label}
        value={value ?? ''}
        onChange={(val) => onChange((val as string) || null)}
        isDisabled={disabled}
      >
        <Select.Trigger className="min-w-[240px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed">
          <Select.Value>{value ? undefined : placeholder}</Select.Value>
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl max-h-60 overflow-y-auto">
          <ListBox>
            <ListBox.Item id="" textValue="未設定">
              <span className="text-gray-500">未設定</span>
            </ListBox.Item>
            {channels.map((ch) => (
              <ListBox.Item key={ch.id} id={ch.id} textValue={channelLabel(ch, categories)}>
                {channelLabel(ch, categories)}
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}

export function ServerBotsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [data, setData] = useState<BotListResponse | null>(null);
  const [channels, setChannels] = useState<ChannelsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const { toastState, showSaving, showSuccess, showError } = useToast();

  useEffect(() => {
    if (!guildId) return;
    const controller = new AbortController();

    Promise.all([
      api.get<BotListResponse>(`/api/guilds/${guildId}/bots`, { signal: controller.signal }),
      api.get<ChannelsData>(`/api/guilds/${guildId}/channels`, { signal: controller.signal }),
    ])
      .then(([bots, ch]) => {
        setData(bots);
        setChannels(ch);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        // channels 取得失敗は非致命的
        api.get<BotListResponse>(`/api/guilds/${guildId}/bots`, { signal: controller.signal })
          .then(setData)
          .catch(() => {});
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [guildId]);

  const updateSettings = useCallback(
    async (instanceNumber: number, patch: Partial<BotInstanceSettings>) => {
      if (!guildId) return;
      setSavingId(instanceNumber);
      showSaving();
      try {
        await api.put(`/api/guilds/${guildId}/bots/${instanceNumber}/settings`, patch);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            bots: prev.bots.map((bot) =>
              bot.instanceNumber === instanceNumber
                ? { ...bot, settings: { ...(bot.settings ?? { autoJoin: false, textChannelId: null, voiceChannelId: null }), ...patch } }
                : bot,
            ),
          };
        });
        showSuccess();
      } catch (err) {
        showError();
        if (!(err instanceof ApiError)) throw err;
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
        showError();
        if (!(err instanceof ApiError)) throw err;
      }
    },
    [guildId, showError],
  );

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-red-400">Bot 情報の読み込みに失敗しました。</p>;

  const totalInstances = data.bots.length;
  const effectiveMaxBots = Math.min(data.maxBots, totalInstances);
  const cats = channels?.categories ?? [];
  const textChannels = channels?.textChannels ?? [];
  const voiceChannels = channels?.voiceChannels ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Bot 管理</h1>
          <p className="text-gray-400">サーバーで利用可能な Bot の管理と設定ができます。</p>
        </div>
        <div className="pt-1">
          <span className="text-sm bg-purple-500/20 text-purple-300 px-3 py-1.5 rounded-xl font-medium">
            利用可能な Bot 数: {effectiveMaxBots} / {totalInstances}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {data.bots.map((bot) => {
          const isSaving = savingId === bot.instanceNumber;
          const isEffectivelyAvailable = bot.isAvailable && bot.instanceNumber <= totalInstances;

          if (!isEffectivelyAvailable) {
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

          const settings = bot.settings ?? { autoJoin: false, textChannelId: null, voiceChannelId: null };

          return (
            <div
              key={bot.instanceNumber}
              className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">{bot.name}</span>
                <StatusBadge
                  label={bot.isActive ? '稼働中' : '停止中'}
                  variant={bot.isActive ? 'active' : 'inactive'}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">ステータス</span>
                {bot.isInGuild ? (
                  <span className="text-green-400">サーバーに参加済み</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">未参加</span>
                    <button
                      onClick={() => handleInvite(bot.instanceNumber)}
                      className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-lg transition-colors"
                    >
                      サーバーに招待
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">自動接続</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {bot.isInGuild
                        ? '誰かが VC に参加したとき自動で接続する'
                        : '参加後に設定可能'}
                    </p>
                  </div>
                  <Switch
                    isSelected={settings.autoJoin}
                    isDisabled={!bot.isInGuild || isSaving}
                    onChange={(v) => updateSettings(bot.instanceNumber, { autoJoin: v })}
                  >
                    {({ isSelected }) => (
                      <Switch.Control className={isSelected ? 'bg-purple-600' : 'bg-white/20'}>
                        <Switch.Thumb />
                      </Switch.Control>
                    )}
                  </Switch>
                </div>

                <ChannelSelect
                  label="VC チャンネル（未設定の場合は任意の VC に参加）"
                  value={settings.voiceChannelId}
                  channels={voiceChannels}
                  categories={cats}
                  placeholder="VC チャンネルを選択"
                  disabled={!bot.isInGuild || isSaving}
                  onChange={(v) => updateSettings(bot.instanceNumber, { voiceChannelId: v })}
                />

                <ChannelSelect
                  label="テキストチャンネル（読み上げ対象チャンネル）"
                  value={settings.textChannelId}
                  channels={textChannels}
                  categories={cats}
                  placeholder="テキストチャンネルを選択"
                  disabled={!bot.isInGuild || isSaving}
                  onChange={(v) => updateSettings(bot.instanceNumber, { textChannelId: v })}
                />
              </div>

            </div>
          );
        })}
      </div>
      <Toast state={toastState} />
    </div>
  );
}
