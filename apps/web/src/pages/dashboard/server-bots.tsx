import { useState, useEffect, useCallback } from 'react';
import { Switch, Select, ListBox } from '@heroui/react';
import { useParams } from 'react-router';
import { api, ApiError } from '../../lib/api';

interface BotInstanceSettings {
  autoJoin: boolean;
  textChannelId: string | null;
  voiceChannelId: string | null;
}

interface BotInstanceInfo {
  instanceId: number;
  name: string;
  botUserId: string;
  isActive: boolean;
  isInGuild: boolean;
  settings: BotInstanceSettings;
}

interface BotListResponse {
  availableCount: number;
  instances: BotInstanceInfo[];
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
          <Select.Value placeholder={placeholder} />
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    async (instanceId: number, patch: Partial<BotInstanceSettings>) => {
      if (!guildId) return;
      setSavingId(instanceId);
      setErrorMessage(null);
      try {
        await api.put(`/api/guilds/${guildId}/bots/${instanceId}/settings`, patch);
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            instances: prev.instances.map((inst) =>
              inst.instanceId === instanceId
                ? { ...inst, settings: { ...inst.settings, ...patch } }
                : inst,
            ),
          };
        });
      } catch (err) {
        if (err instanceof ApiError) setErrorMessage(err.message);
      } finally {
        setSavingId(null);
      }
    },
    [guildId],
  );

  const handleInvite = useCallback(
    async (instanceId: number) => {
      if (!guildId) return;
      try {
        const result = await api.get<{ url: string }>(
          `/api/guilds/${guildId}/bots/${instanceId}/invite`,
        );
        window.open(result.url, '_blank', 'noopener,noreferrer');
      } catch (err) {
        if (err instanceof ApiError) setErrorMessage(err.message);
      }
    },
    [guildId],
  );

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-red-400">Bot 情報の読み込みに失敗しました。</p>;

  const totalSlots = 5; // MAX_BOT_INSTANCES
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
            利用可能な Bot 数: {data.availableCount} / {totalSlots}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {Array.from({ length: totalSlots }, (_, i) => i + 1).map((slot) => {
          const instance = data.instances.find((inst) => inst.instanceId === slot);
          const isAvailable = slot <= data.availableCount;
          const isSaving = savingId === slot;

          if (!isAvailable) {
            return (
              <div
                key={slot}
                className="bg-[#12121a] border border-white/5 rounded-2xl p-6 opacity-50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">SumireVox #{slot}</span>
                  <StatusBadge label="利用不可" variant="unavailable" />
                </div>
                <p className="text-sm text-gray-500 mt-2">このインスタンスを利用するにはブーストが必要です。</p>
              </div>
            );
          }

          if (!instance) {
            return (
              <div
                key={slot}
                className="bg-[#12121a] border border-white/5 rounded-2xl p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="text-white font-semibold">SumireVox #{slot}</span>
                  <StatusBadge label="読み込み中" variant="inactive" />
                </div>
              </div>
            );
          }

          return (
            <div
              key={slot}
              className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-white font-semibold">{instance.name}</span>
                <StatusBadge
                  label={instance.isActive ? '稼働中' : '停止中'}
                  variant={instance.isActive ? 'active' : 'inactive'}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">ステータス</span>
                {instance.isInGuild ? (
                  <span className="text-green-400">サーバーに参加済み</span>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-gray-500">未参加</span>
                    <button
                      onClick={() => handleInvite(instance.instanceId)}
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
                      {instance.isInGuild
                        ? '誰かが VC に参加したとき自動で接続する'
                        : '参加後に設定可能'}
                    </p>
                  </div>
                  <Switch
                    isSelected={instance.settings.autoJoin}
                    isDisabled={!instance.isInGuild || isSaving}
                    onChange={(v) => updateSettings(instance.instanceId, { autoJoin: v })}
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
                  value={instance.settings.voiceChannelId}
                  channels={voiceChannels}
                  categories={cats}
                  placeholder="VC チャンネルを選択"
                  disabled={!instance.isInGuild || isSaving}
                  onChange={(v) => updateSettings(instance.instanceId, { voiceChannelId: v })}
                />

                <ChannelSelect
                  label="テキストチャンネル（読み上げ対象チャンネル）"
                  value={instance.settings.textChannelId}
                  channels={textChannels}
                  categories={cats}
                  placeholder="テキストチャンネルを選択"
                  disabled={!instance.isInGuild || isSaving}
                  onChange={(v) => updateSettings(instance.instanceId, { textChannelId: v })}
                />
              </div>

              {isSaving && (
                <p className="text-xs text-gray-500">保存中…</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
