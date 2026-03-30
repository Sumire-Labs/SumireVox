import { useState, useEffect, useCallback } from 'react';
import { Switch, Select, ListBox, Spinner } from '@heroui/react';
import { Link, useParams } from 'react-router';
import { api, ApiError } from '../lib/api';
import { Toast, useToast } from '../components/toast';

interface ServerSettings {
  guildId: string;
  maxReadLength: number;
  readUsername: boolean;
  addSanSuffix: boolean;
  romajiReading: boolean;
  uppercaseReading: boolean;
  joinLeaveNotification: boolean;
  greetingOnJoin: boolean;
  customEmojiHandling: 'read_name' | 'remove';
  readTargetType: 'text_only' | 'text_and_sticker' | 'text_sticker_and_attachment';
  defaultSpeakerId: number | null;
  adminRoleId: string | null;
  dictionaryPermission: 'everyone' | 'admin_only';
  manualPremium: boolean;
  isPremium: boolean;
}

interface ServerInfo {
  name: string;
  icon: string | null;
}

interface Role {
  id: string;
  name: string;
  color: number;
}

interface Speaker {
  id: number;
  name: string;
}

// API レスポンスの形（settings + serverInfo + roles が一体）
interface SettingsApiResponse extends ServerSettings {
  name: string;
  icon: string | null;
  roles: Role[];
}

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

function BotStatusBadge({ label, variant }: { label: string; variant: 'active' | 'inactive' | 'unavailable' }) {
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

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#12121a] border border-white/5 rounded-2xl p-6 flex flex-col gap-5">
      <h2 className="text-base font-semibold text-white">{title}</h2>
      {children}
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-white">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function RangeSlider({ value, min, max, step, onChange, onChangeEnd }: {
  value: number; min: number; max: number; step: number;
  onChange: (value: number) => void;
  onChangeEnd: (value: number) => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onMouseUp={(e) => onChangeEnd(Number((e.target as HTMLInputElement).value))}
      onTouchEnd={(e) => onChangeEnd(Number((e.target as HTMLInputElement).value))}
      className="slider-purple w-full h-2 rounded-full appearance-none cursor-pointer"
      style={{ '--slider-progress': `${progress}%` } as React.CSSProperties}
    />
  );
}

function SettingSwitch({ isSelected, onChange, label }: { isSelected: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <Switch aria-label={label} isSelected={isSelected} onChange={onChange}>
      {({ isSelected: sel }) => (
        <Switch.Control className={sel ? 'bg-purple-600' : 'bg-white/20'}>
          <Switch.Thumb />
        </Switch.Control>
      )}
    </Switch>
  );
}

export function AdminServerSettingsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  // 設定値・サーバー情報・ロールを別々に管理して save 時に混在しないようにする
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [botData, setBotData] = useState<BotListResponse | null>(null);
  const [channelsData, setChannelsData] = useState<ChannelsData | null>(null);
  const [savingBotId, setSavingBotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { toastState, showSaving, showSuccess, showError } = useToast();

  useEffect(() => {
    if (!guildId) return;

    Promise.all([
      api.get<SettingsApiResponse>(`/api/admin/servers/${guildId}/settings`),
      api.get<Speaker[]>('/api/voicevox/speakers').catch(() => [] as Speaker[]),
      api.get<BotListResponse>(`/api/admin/servers/${guildId}/bots`).catch(() => null),
      api.get<ChannelsData>(`/api/admin/servers/${guildId}/channels`).catch(() => null),
    ])
      .then(([res, sp, bots, ch]) => {
        const { name, icon, roles: fetchedRoles, ...rest } = res;
        setSettings(rest);
        setServerInfo({ name, icon });
        setRoles(fetchedRoles ?? []);
        setSpeakers(sp);
        setBotData(bots);
        setChannelsData(ch);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  const save = useCallback(async (patch: Partial<ServerSettings>) => {
    if (!guildId) return;
    showSaving();
    try {
      // PUT レスポンスには name/icon/roles が含まれないため settings のみ更新する
      const updated = await api.put<ServerSettings>(`/api/admin/servers/${guildId}/settings`, patch);
      setSettings(updated);
      showSuccess();
    } catch (err) {
      showError();
      if (!(err instanceof ApiError)) throw err;
    }
  }, [guildId, showSaving, showSuccess, showError]);

  const handleSwitch = (field: keyof ServerSettings, value: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    save({ [field]: value });
  };

  const handleSelect = (field: keyof ServerSettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    save({ [field]: value });
  };

  const handleSettingChange = (field: keyof ServerSettings, value: number) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    save({ [field]: value });
  };

  const updateBotSettings = useCallback(
    async (instanceNumber: number, patch: Partial<BotInstanceSettings>) => {
      if (!guildId) return;
      setSavingBotId(instanceNumber);
      showSaving();
      try {
        await api.put(`/api/admin/servers/${guildId}/bots/${instanceNumber}/settings`, patch);
        setBotData((prev) => {
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
        setSavingBotId(null);
      }
    },
    [guildId, showSaving, showSuccess, showError],
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Spinner size="lg" className="text-purple-500" />
      </div>
    );
  }
  if (!settings) return <p className="text-red-400">設定の読み込みに失敗しました。</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/servers" className="text-sm text-gray-400 hover:text-white transition-colors">
              ← サーバー一覧
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {serverInfo?.icon ? (
              <img
                src={`https://cdn.discordapp.com/icons/${guildId}/${serverInfo.icon}.png?size=64`}
                alt={serverInfo?.name ?? guildId}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <div className="bg-gray-700 rounded-full w-10 h-10 flex items-center justify-center text-sm">
                {serverInfo?.name?.charAt(0) ?? 'S'}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-white">{serverInfo?.name ?? guildId}</h1>
              <p className="text-xs text-gray-500 font-mono">{guildId}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {settings.isPremium ? (
            <span className="text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full">
              PREMIUM
            </span>
          ) : (
            <span className="text-xs font-semibold bg-white/5 text-gray-400 border border-white/10 px-3 py-1 rounded-full">
              FREE
            </span>
          )}
        </div>
      </div>

      {/* 読み上げ設定 */}
      <SectionCard title="読み上げ設定">
        <div className="py-3 border-b border-white/5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">最大文字数</p>
              <p className="text-xs text-gray-400">{settings.isPremium ? 'PREMIUM: 上限200' : 'FREE: 上限50'}</p>
            </div>
            <span className="text-sm font-medium text-white">{settings.maxReadLength}文字</span>
          </div>
          <RangeSlider
            value={settings.maxReadLength}
            min={10}
            max={settings.isPremium ? 200 : 50}
            step={10}
            onChange={(val) => setSettings((prev) => prev ? { ...prev, maxReadLength: val } : prev)}
            onChangeEnd={(val) => handleSettingChange('maxReadLength', val)}
          />
        </div>
        <SettingRow label="名前読み上げ" description="メッセージ送信者の名前を読み上げる">
          <SettingSwitch label="名前読み上げ" isSelected={settings.readUsername} onChange={(v) => handleSwitch('readUsername', v)} />
        </SettingRow>
        <SettingRow label="さん付け" description="名前の後ろに「さん」を付ける">
          <SettingSwitch label="さん付け" isSelected={settings.addSanSuffix} onChange={(v) => handleSwitch('addSanSuffix', v)} />
        </SettingRow>
        <SettingRow label="ローマ字ひらがな変換" description="ローマ字パターンをひらがなに変換して読み上げる">
          <SettingSwitch label="ローマ字読み" isSelected={settings.romajiReading} onChange={(v) => handleSwitch('romajiReading', v)} />
        </SettingRow>
        <SettingRow label="大文字ローマ字読み" description="大文字のローマ字（API, URL等）をひらがなで読み上げる">
          <SettingSwitch label="大文字ローマ字読み" isSelected={settings.uppercaseReading} onChange={(v) => handleSwitch('uppercaseReading', v)} />
        </SettingRow>
      </SectionCard>

      {/* 通知設定 */}
      <SectionCard title="通知設定">
        <SettingRow label="入退室通知" description="VC の参加・退出・移動を読み上げる">
          <SettingSwitch label="入退室通知" isSelected={settings.joinLeaveNotification} onChange={(v) => handleSwitch('joinLeaveNotification', v)} />
        </SettingRow>
        <SettingRow label="Bot 入室時の挨拶" description="/join 時に「接続しました」を読み上げる">
          <SettingSwitch label="Bot 入室時の挨拶" isSelected={settings.greetingOnJoin} onChange={(v) => handleSwitch('greetingOnJoin', v)} />
        </SettingRow>
      </SectionCard>

      {/* フィルタ設定 */}
      <SectionCard title="フィルタ設定">
        <SettingRow label="カスタム絵文字の扱い">
          <Select
            aria-label="カスタム絵文字の扱い"
            value={settings.customEmojiHandling}
            onChange={(val) => handleSelect('customEmojiHandling', val as string)}
          >
            <Select.Trigger className="min-w-[200px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
              <ListBox>
                <ListBox.Item id="read_name" textValue="名前を読み上げる">名前を読み上げる</ListBox.Item>
                <ListBox.Item id="remove" textValue="除去する">除去する</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>
        <SettingRow label="読み上げ対象">
          <Select
            aria-label="読み上げ対象"
            value={settings.readTargetType}
            onChange={(val) => handleSelect('readTargetType', val as string)}
          >
            <Select.Trigger className="min-w-[240px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
              <ListBox>
                <ListBox.Item id="text_only" textValue="テキストのみ">テキストのみ</ListBox.Item>
                <ListBox.Item id="text_and_sticker" textValue="テキスト + スタンプ">テキスト + スタンプ</ListBox.Item>
                <ListBox.Item id="text_sticker_and_attachment" textValue="テキスト + スタンプ + 添付">テキスト + スタンプ + 添付</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>
      </SectionCard>

      {/* 接続設定 */}
      <SectionCard title="接続設定">
        <SettingRow label="デフォルト話者" description="ユーザー設定がない場合に使用する話者">
          <Select
            aria-label="デフォルト話者"
            value={settings.defaultSpeakerId !== null ? String(settings.defaultSpeakerId) : ''}
            onChange={(val) => {
              const v = val as string;
              const numVal = v ? Number(v) : null;
              setSettings((prev) => prev ? { ...prev, defaultSpeakerId: numVal } : prev);
              save({ defaultSpeakerId: numVal });
            }}
          >
            <Select.Trigger className="min-w-[240px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl max-h-60 overflow-y-auto">
              <ListBox>
                {speakers.map((s) => (
                  <ListBox.Item key={s.id} id={String(s.id)} textValue={s.name}>
                    {s.name}
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>
      </SectionCard>

      {/* Bot 設定 */}
      {botData && (
        <SectionCard title="Bot 設定">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-gray-500">各 Bot の自動接続・チャンネル設定</p>
            <span className="text-xs bg-purple-500/20 text-purple-300 px-2.5 py-1 rounded-full font-medium">
              利用可能: {Math.min(botData.maxBots, botData.bots.length)} / {botData.bots.length}
            </span>
          </div>
          <div className="flex flex-col gap-4">
            {botData.bots.map((bot) => {
              const effectiveMaxBots = Math.min(botData.maxBots, botData.bots.length);
              const isEffectivelyAvailable = bot.isAvailable && bot.instanceNumber <= effectiveMaxBots;
              const isSaving = savingBotId === bot.instanceNumber;
              const cats = channelsData?.categories ?? [];
              const textChannels = channelsData?.textChannels ?? [];
              const voiceChannels = channelsData?.voiceChannels ?? [];

              if (!isEffectivelyAvailable) {
                return (
                  <div key={bot.instanceNumber} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 opacity-50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{bot.name}</span>
                      <BotStatusBadge label="利用不可" variant="unavailable" />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">このインスタンスを利用するにはブーストが必要です。</p>
                  </div>
                );
              }

              const botSettings = bot.settings ?? { autoJoin: false, textChannelId: null, voiceChannelId: null };

              return (
                <div key={bot.instanceNumber} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">{bot.name}</span>
                    <div className="flex items-center gap-2">
                      {bot.isInGuild ? (
                        <span className="text-xs text-green-400">参加済み</span>
                      ) : (
                        <span className="text-xs text-gray-500">未参加</span>
                      )}
                      <BotStatusBadge
                        label={bot.isActive ? '稼働中' : '停止中'}
                        variant={bot.isActive ? 'active' : 'inactive'}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">自動接続</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {bot.isInGuild ? '誰かが VC に参加したとき自動で接続する' : '参加後に設定可能'}
                      </p>
                    </div>
                    <Switch
                      isSelected={botSettings.autoJoin}
                      isDisabled={!bot.isInGuild || isSaving}
                      onChange={(v) => updateBotSettings(bot.instanceNumber, { autoJoin: v })}
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
                    value={botSettings.voiceChannelId}
                    channels={voiceChannels}
                    categories={cats}
                    placeholder="VC チャンネルを選択"
                    disabled={!bot.isInGuild || isSaving}
                    onChange={(v) => updateBotSettings(bot.instanceNumber, { voiceChannelId: v })}
                  />
                  <ChannelSelect
                    label="テキストチャンネル（読み上げ対象チャンネル）"
                    value={botSettings.textChannelId}
                    channels={textChannels}
                    categories={cats}
                    placeholder="テキストチャンネルを選択"
                    disabled={!bot.isInGuild || isSaving}
                    onChange={(v) => updateBotSettings(bot.instanceNumber, { textChannelId: v })}
                  />
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* 権限設定 */}
      <SectionCard title="権限設定">
        <SettingRow label="管理ロール" description="このロールのユーザーを管理者として扱う">
          <Select
            aria-label="管理ロール"
            value={settings.adminRoleId ?? ''}
            onChange={(val) => {
              const roleVal = (val as string) || null;
              setSettings((prev) => prev ? { ...prev, adminRoleId: roleVal } : prev);
              save({ adminRoleId: roleVal });
            }}
          >
            <Select.Trigger className="min-w-[240px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl max-h-60 overflow-y-auto">
              <ListBox>
                <ListBox.Item id="" textValue="未設定（サーバー管理者権限）">
                  未設定（サーバー管理者権限）
                </ListBox.Item>
                {roles.map((role) => (
                  <ListBox.Item key={role.id} id={role.id} textValue={role.name}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{
                          backgroundColor: role.color
                            ? `#${role.color.toString(16).padStart(6, '0')}`
                            : '#99aab5',
                        }}
                      />
                      {role.name}
                    </div>
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>
        <SettingRow label="サーバー辞書追加権限">
          <Select
            aria-label="サーバー辞書追加権限"
            value={settings.dictionaryPermission}
            onChange={(val) => handleSelect('dictionaryPermission', val as string)}
          >
            <Select.Trigger className="min-w-[220px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
              <ListBox>
                <ListBox.Item id="everyone" textValue="全ユーザー">全ユーザー</ListBox.Item>
                <ListBox.Item id="admin_only" textValue="管理者 / 指定ロールのみ">管理者 / 指定ロールのみ</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>
      </SectionCard>

      <Toast state={toastState} />
    </div>
  );
}
