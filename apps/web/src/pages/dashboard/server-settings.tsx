import { useState, useEffect, useCallback } from 'react';
import { Switch, Select, ListBox, NumberField, TextField, Label, Input } from '@heroui/react';
import { Link, useParams } from 'react-router';
import { api, ApiError } from '../../lib/api';

interface GuildSettings {
  guildId: string;
  maxReadLength: number;
  readName: boolean;
  honorific: boolean;
  romajiRead: boolean;
  joinLeaveNotify: boolean;
  greeting: boolean;
  customEmojiMode: 'READ_NAME' | 'REMOVE';
  readTargetType: 'TEXT_ONLY' | 'TEXT_STICKER' | 'TEXT_STICKER_ATTACHMENT';
  autoJoin: boolean;
  defaultTextChannelId: string | null;
  defaultSpeakerId: number | null;
  adminRoleId: string | null;
  dictPermission: 'ALL_USERS' | 'ADMIN_ONLY';
  manualPremium: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

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

function SettingSwitch({ isSelected, onChange, isDisabled }: { isSelected: boolean; onChange: (v: boolean) => void; isDisabled?: boolean }) {
  return (
    <Switch isSelected={isSelected} onChange={onChange} isDisabled={isDisabled}>
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
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!guildId) return;
    api.get<GuildSettings>(`/api/guilds/${guildId}/settings`)
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [guildId]);

  const save = useCallback(async (patch: Partial<GuildSettings>) => {
    if (!guildId) return;
    setSaveStatus('saving');
    setErrorMessage(null);
    try {
      const updated = await api.put<GuildSettings>(`/api/guilds/${guildId}/settings`, patch);
      setSettings(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
      if (err instanceof ApiError) setErrorMessage(err.message);
    }
  }, [guildId]);

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

  const handleNumber = (field: keyof GuildSettings, value: number | undefined) => {
    if (!settings || value === undefined) return;
    save({ [field]: value });
  };

  const handleStringBlur = (field: keyof GuildSettings, value: string) => {
    save({ [field]: value || null });
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
          {saveStatus === 'saving' && (
            <span className="text-sm text-gray-400">保存中…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-sm bg-green-500/20 text-green-400 px-3 py-1 rounded-full">保存しました</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm bg-red-500/20 text-red-400 px-3 py-1 rounded-full">
              {errorMessage ?? '保存に失敗しました'}
            </span>
          )}
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
        <SettingRow label="最大文字数" description="FREE: 上限50 / PREMIUM: 上限200">
          <NumberField
            value={settings.maxReadLength}
            onChange={(val) => handleNumber('maxReadLength', val)}
            minValue={1}
            maxValue={settings.manualPremium ? 200 : 50}
          >
            <NumberField.Group className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <NumberField.DecrementButton className="px-2.5 text-gray-400 hover:text-white hover:bg-white/5 h-full" />
              <NumberField.Input className="w-14 text-white text-center bg-transparent text-sm py-1.5 focus:outline-none" />
              <NumberField.IncrementButton className="px-2.5 text-gray-400 hover:text-white hover:bg-white/5 h-full" />
            </NumberField.Group>
          </NumberField>
        </SettingRow>
        <SettingRow label="名前読み上げ" description="メッセージ送信者の名前を読み上げる">
          <SettingSwitch isSelected={settings.readName} onChange={(v) => handleSwitch('readName', v)} />
        </SettingRow>
        <SettingRow label="さん付け" description="名前の後ろに「さん」を付ける">
          <SettingSwitch isSelected={settings.honorific} onChange={(v) => handleSwitch('honorific', v)} />
        </SettingRow>
        <SettingRow label="ローマ字読み" description="ローマ字パターンをそのまま読む">
          <SettingSwitch isSelected={settings.romajiRead} onChange={(v) => handleSwitch('romajiRead', v)} />
        </SettingRow>
      </SectionCard>

      {/* 通知設定 */}
      <SectionCard title="通知設定">
        <SettingRow label="入退室通知" description="VC の参加・退出・移動を読み上げる">
          <SettingSwitch isSelected={settings.joinLeaveNotify} onChange={(v) => handleSwitch('joinLeaveNotify', v)} />
        </SettingRow>
        <SettingRow label="Bot 入室時の挨拶" description="/join 時に「接続しました」を読み上げる">
          <SettingSwitch isSelected={settings.greeting} onChange={(v) => handleSwitch('greeting', v)} />
        </SettingRow>
      </SectionCard>

      {/* フィルタ設定 */}
      <SectionCard title="フィルタ設定">
        <SettingRow label="カスタム絵文字の扱い">
          <Select
            value={settings.customEmojiMode}
            onChange={(val) => handleSelect('customEmojiMode', val as string)}
          >
            <Select.Trigger className="min-w-[200px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
              <ListBox>
                <ListBox.Item id="READ_NAME">名前を読み上げる</ListBox.Item>
                <ListBox.Item id="REMOVE">除去する</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>
        <SettingRow label="読み上げ対象">
          <Select
            value={settings.readTargetType}
            onChange={(val) => handleSelect('readTargetType', val as string)}
          >
            <Select.Trigger className="min-w-[240px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
              <ListBox>
                <ListBox.Item id="TEXT_ONLY">テキストのみ</ListBox.Item>
                <ListBox.Item id="TEXT_STICKER">テキスト + スタンプ</ListBox.Item>
                <ListBox.Item id="TEXT_STICKER_ATTACHMENT">テキスト + スタンプ + 添付</ListBox.Item>
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
        <SettingRow label="デフォルト話者 ID" description="ユーザー設定がない場合に使用する話者">
          <NumberField
            defaultValue={settings.defaultSpeakerId ?? undefined}
            onChange={(val) => handleNumber('defaultSpeakerId', val)}
            minValue={0}
          >
            <NumberField.Group className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <NumberField.DecrementButton className="px-2.5 text-gray-400 hover:text-white hover:bg-white/5 h-full" />
              <NumberField.Input className="w-16 text-white text-center bg-transparent text-sm py-1.5 focus:outline-none" />
              <NumberField.IncrementButton className="px-2.5 text-gray-400 hover:text-white hover:bg-white/5 h-full" />
            </NumberField.Group>
          </NumberField>
        </SettingRow>
      </SectionCard>

      {/* 権限設定 */}
      <SectionCard title="権限設定">
        <SettingRow label="管理ロール ID" description="このロールのユーザーを管理者として扱う">
          <TextField defaultValue={settings.adminRoleId ?? ''}>
            <Label className="sr-only">管理ロール ID</Label>
            <Input
              placeholder="ロール ID"
              className="w-48 bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500/50 placeholder:text-gray-600"
              onBlur={(e: React.FocusEvent<HTMLInputElement>) => handleStringBlur('adminRoleId', e.currentTarget.value)}
            />
          </TextField>
        </SettingRow>
        <SettingRow label="サーバー辞書追加権限">
          <Select
            value={settings.dictPermission}
            onChange={(val) => handleSelect('dictPermission', val as string)}
          >
            <Select.Trigger className="min-w-[220px] bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm">
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover className="bg-[#1a1a2e] border border-white/10 rounded-xl">
              <ListBox>
                <ListBox.Item id="ALL_USERS">全ユーザー</ListBox.Item>
                <ListBox.Item id="ADMIN_ONLY">管理者 / 指定ロールのみ</ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingRow>
      </SectionCard>
    </div>
  );
}
