import { useState, useEffect, useCallback } from 'react';
import { Switch, Select, ListBox } from '@heroui/react';
import { Link, useParams } from 'react-router';
import { api, ApiError } from '../../lib/api';
import { Toast, useToast } from '../../components/toast';

interface GuildSettings {
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
  autoJoin: boolean;
  defaultTextChannelId: string | null;
  defaultSpeakerId: number | null;
  adminRoleId: string | null;
  dictionaryPermission: 'everyone' | 'admin_only';
  manualPremium: boolean;
  isPremium: boolean;
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

function SettingSwitch({ isSelected, onChange, isDisabled, label }: { isSelected: boolean; onChange: (v: boolean) => void; isDisabled?: boolean; label: string }) {
  return (
    <Switch aria-label={label} isSelected={isSelected} onChange={onChange} isDisabled={isDisabled}>
      {({ isSelected: sel }) => (
        <Switch.Control className={sel ? 'bg-purple-600' : 'bg-white/20'}>
          <Switch.Thumb />
        </Switch.Control>
      )}
    </Switch>
  );
}

export function ServerSettingsPage() {
  const { guildId } = useParams<{ guildId: string }>();
  const [settings, setSettings] = useState<GuildSettings | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const { toastState, showSaving, showSuccess, showError } = useToast();

  useEffect(() => {
    if (!guildId) return;
    const controller = new AbortController();

    Promise.all([
      api.get<GuildSettings>(`/api/guilds/${guildId}/settings`, { signal: controller.signal }),
      api.get<Role[]>(`/api/guilds/${guildId}/roles`, { signal: controller.signal }),
      api.get<Speaker[]>('/api/voicevox/speakers', { signal: controller.signal }),
    ])
      .then(([s, r, sp]) => {
        setSettings(s);
        setRoles(r);
        setSpeakers(sp);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        // roles/speakers 取得失敗は非致命的: settings だけでも表示する
        api.get<GuildSettings>(`/api/guilds/${guildId}/settings`, { signal: controller.signal })
          .then(setSettings)
          .catch(() => {});
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [guildId]);

  const save = useCallback(async (patch: Partial<GuildSettings>) => {
    if (!guildId) return;
    showSaving();
    try {
      const updated = await api.put<GuildSettings>(`/api/guilds/${guildId}/settings`, patch);
      setSettings(updated);
      showSuccess();
    } catch (err) {
      showError();
      if (!(err instanceof ApiError)) throw err;
    }
  }, [guildId, showSaving, showSuccess, showError]);

  const handleSwitch = (field: keyof GuildSettings, value: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    save({ [field]: value });
  };

  const handleSelect = (field: keyof GuildSettings, value: string) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    save({ [field]: value });
  };

  const handleSettingChange = (field: keyof GuildSettings, value: number) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
    save({ [field]: value });
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-20">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!settings) return <p className="text-red-400">設定の読み込みに失敗しました。</p>;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">サーバー設定</h1>
          <p className="text-gray-400">読み上げ・通知・フィルタ・権限の設定</p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <Link
            to={`/dashboard/servers/${guildId}/bots`}
            className="text-sm border border-white/20 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition-all"
          >
            Bot 管理
          </Link>
          <Link
            to={`/dashboard/servers/${guildId}/dictionary`}
            className="text-sm border border-white/20 bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-xl transition-all"
          >
            辞書管理
          </Link>
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
            onChange={(val) => setSettings(prev => prev ? { ...prev, maxReadLength: val } : prev)}
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
        <div className="bg-purple-500/10 border border-purple-500/20 text-purple-300 text-sm px-4 py-3 rounded-xl">
          💡 自動接続の設定は{' '}
          <Link
            to={`/dashboard/servers/${guildId}/bots`}
            className="underline hover:text-purple-200"
          >
            Bot 管理
          </Link>{' '}
          から行ってください。
        </div>
        <SettingRow label="デフォルト話者" description="ユーザー設定がない場合に使用する話者">
          <Select
            aria-label="デフォルト話者"
            value={settings.defaultSpeakerId !== null ? String(settings.defaultSpeakerId) : ''}
            onChange={(val) => {
              const v = val as string;
              if (!settings) return;
              const numVal = v ? Number(v) : null;
              setSettings({ ...settings, defaultSpeakerId: numVal });
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

      {/* 権限設定 */}
      <SectionCard title="権限設定">
        <SettingRow label="管理ロール" description="このロールのユーザーを管理者として扱う">
          <Select
            aria-label="管理ロール"
            value={settings.adminRoleId ?? ''}
            onChange={(val) => {
              const v = val as string;
              if (!settings) return;
              const roleVal = v || null;
              setSettings({ ...settings, adminRoleId: roleVal });
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
