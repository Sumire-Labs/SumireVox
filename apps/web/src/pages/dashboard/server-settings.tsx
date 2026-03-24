import { useState, useEffect, useCallback } from 'react';
import { Switch, Select, SelectItem } from '@heroui/react';
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

  const handleNumberBlur = (field: keyof GuildSettings, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) return;
    save({ [field]: num });
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
          <input
            type="number"
            min={1}
            max={settings.manualPremium ? 200 : 50}
            defaultValue={String(settings.maxReadLength)}
            className="w-20 bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500/50 text-right"
            onBlur={(e) => handleNumberBlur('maxReadLength', e.target.value)}
          />
        </SettingRow>
        <SettingRow label="名前読み上げ" description="メッセージ送信者の名前を読み上げる">
          <Switch
            isSelected={settings.readName}
            onValueChange={(v) => handleSwitch('readName', v)}
            classNames={{ wrapper: 'bg-white/10 group-data-[selected=true]:bg-purple-600' }}
          />
        </SettingRow>
        <SettingRow label="さん付け" description="名前の後ろに「さん」を付ける">
          <Switch
            isSelected={settings.honorific}
            onValueChange={(v) => handleSwitch('honorific', v)}
            classNames={{ wrapper: 'bg-white/10 group-data-[selected=true]:bg-purple-600' }}
          />
        </SettingRow>
        <SettingRow label="ローマ字読み" description="ローマ字パターンをそのまま読む">
          <Switch
            isSelected={settings.romajiRead}
            onValueChange={(v) => handleSwitch('romajiRead', v)}
            classNames={{ wrapper: 'bg-white/10 group-data-[selected=true]:bg-purple-600' }}
          />
        </SettingRow>
      </SectionCard>

      {/* 通知設定 */}
      <SectionCard title="通知設定">
        <SettingRow label="入退室通知" description="VC の参加・退出・移動を読み上げる">
          <Switch
            isSelected={settings.joinLeaveNotify}
            onValueChange={(v) => handleSwitch('joinLeaveNotify', v)}
            classNames={{ wrapper: 'bg-white/10 group-data-[selected=true]:bg-purple-600' }}
          />
        </SettingRow>
        <SettingRow label="Bot 入室時の挨拶" description="/join 時に「接続しました」を読み上げる">
          <Switch
            isSelected={settings.greeting}
            onValueChange={(v) => handleSwitch('greeting', v)}
            classNames={{ wrapper: 'bg-white/10 group-data-[selected=true]:bg-purple-600' }}
          />
        </SettingRow>
      </SectionCard>

      {/* フィルタ設定 */}
      <SectionCard title="フィルタ設定">
        <SettingRow label="カスタム絵文字の扱い">
          <Select
            size="sm"
            className="min-w-[200px]"
            classNames={{ trigger: 'bg-white/5 border-white/10' }}
            selectedKeys={[settings.customEmojiMode]}
            onChange={(e) => handleSelect('customEmojiMode', e.target.value)}
          >
            <SelectItem key="READ_NAME">名前を読み上げる</SelectItem>
            <SelectItem key="REMOVE">除去する</SelectItem>
          </Select>
        </SettingRow>
        <SettingRow label="読み上げ対象">
          <Select
            size="sm"
            className="min-w-[240px]"
            classNames={{ trigger: 'bg-white/5 border-white/10' }}
            selectedKeys={[settings.readTargetType]}
            onChange={(e) => handleSelect('readTargetType', e.target.value)}
          >
            <SelectItem key="TEXT_ONLY">テキストのみ</SelectItem>
            <SelectItem key="TEXT_STICKER">テキスト + スタンプ</SelectItem>
            <SelectItem key="TEXT_STICKER_ATTACHMENT">テキスト + スタンプ + 添付</SelectItem>
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
          <input
            type="number"
            placeholder="話者 ID"
            defaultValue={settings.defaultSpeakerId != null ? String(settings.defaultSpeakerId) : ''}
            className="w-28 bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500/50 placeholder-gray-600 text-right"
            onBlur={(e) => handleNumberBlur('defaultSpeakerId', e.target.value)}
          />
        </SettingRow>
      </SectionCard>

      {/* 権限設定 */}
      <SectionCard title="権限設定">
        <SettingRow label="管理ロール ID" description="このロールのユーザーを管理者として扱う">
          <input
            placeholder="ロール ID"
            defaultValue={settings.adminRoleId ?? ''}
            className="w-48 bg-white/5 border border-white/10 text-white rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-purple-500/50 placeholder-gray-600"
            onBlur={(e) => handleStringBlur('adminRoleId', e.target.value)}
          />
        </SettingRow>
        <SettingRow label="サーバー辞書追加権限">
          <Select
            size="sm"
            className="min-w-[220px]"
            classNames={{ trigger: 'bg-white/5 border-white/10' }}
            selectedKeys={[settings.dictPermission]}
            onChange={(e) => handleSelect('dictPermission', e.target.value)}
          >
            <SelectItem key="ALL_USERS">全ユーザー</SelectItem>
            <SelectItem key="ADMIN_ONLY">管理者 / 指定ロールのみ</SelectItem>
          </Select>
        </SettingRow>
      </SectionCard>
    </div>
  );
}
