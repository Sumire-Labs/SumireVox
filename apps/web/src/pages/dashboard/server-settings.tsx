import { useState, useEffect, useCallback } from 'react';
import {
  Card, CardBody, CardHeader, Switch, Input, Select, SelectItem,
  Spinner, Button, Divider, Chip,
} from '@heroui/react';
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

  if (loading) return <Spinner size="lg" color="primary" className="mx-auto mt-20" />;
  if (!settings) return <p className="text-danger">設定の読み込みに失敗しました。</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">サーバー設定</h1>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <Spinner size="sm" />}
          {saveStatus === 'saved' && <Chip color="success" size="sm">保存しました</Chip>}
          {saveStatus === 'error' && <Chip color="danger" size="sm">{errorMessage ?? '保存に失敗しました'}</Chip>}
          <Button as={Link} to={`/dashboard/servers/${guildId}/dictionary`} variant="flat" size="sm">
            辞書管理
          </Button>
        </div>
      </div>

      {/* 読み上げ設定 */}
      <Card>
        <CardHeader className="font-semibold">読み上げ設定</CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">最大文字数</p>
              <p className="text-sm text-default-500">FREE: 上限50 / PREMIUM: 上限200</p>
            </div>
            <Input
              type="number"
              min={1}
              max={settings.manualPremium ? 200 : 50}
              defaultValue={String(settings.maxReadLength)}
              className="max-w-[100px]"
              onBlur={(e) => handleNumberBlur('maxReadLength', e.target.value)}
            />
          </div>
          <Divider />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">名前読み上げ</p>
              <p className="text-sm text-default-500">メッセージ送信者の名前を読み上げる</p>
            </div>
            <Switch
              isSelected={settings.readName}
              onValueChange={(v) => handleSwitch('readName', v)}
            />
          </div>
          <Divider />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">さん付け</p>
              <p className="text-sm text-default-500">名前の後ろに「さん」を付ける</p>
            </div>
            <Switch
              isSelected={settings.honorific}
              onValueChange={(v) => handleSwitch('honorific', v)}
            />
          </div>
          <Divider />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">ローマ字読み</p>
              <p className="text-sm text-default-500">ローマ字パターンをそのまま読む</p>
            </div>
            <Switch
              isSelected={settings.romajiRead}
              onValueChange={(v) => handleSwitch('romajiRead', v)}
            />
          </div>
        </CardBody>
      </Card>

      {/* 通知設定 */}
      <Card>
        <CardHeader className="font-semibold">通知設定</CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">入退室通知</p>
              <p className="text-sm text-default-500">VC の参加・退出・移動を読み上げる</p>
            </div>
            <Switch
              isSelected={settings.joinLeaveNotify}
              onValueChange={(v) => handleSwitch('joinLeaveNotify', v)}
            />
          </div>
          <Divider />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Bot 入室時の挨拶</p>
              <p className="text-sm text-default-500">/join 時に「接続しました」を読み上げる</p>
            </div>
            <Switch
              isSelected={settings.greeting}
              onValueChange={(v) => handleSwitch('greeting', v)}
            />
          </div>
        </CardBody>
      </Card>

      {/* フィルタ設定 */}
      <Card>
        <CardHeader className="font-semibold">フィルタ設定</CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium">カスタム絵文字の扱い</p>
            <Select
              size="sm"
              className="max-w-[220px]"
              selectedKeys={[settings.customEmojiMode]}
              onChange={(e) => handleSelect('customEmojiMode', e.target.value)}
            >
              <SelectItem key="READ_NAME" value="READ_NAME">名前を読み上げる</SelectItem>
              <SelectItem key="REMOVE" value="REMOVE">除去する</SelectItem>
            </Select>
          </div>
          <Divider />
          <div className="flex items-center justify-between">
            <p className="font-medium">読み上げ対象</p>
            <Select
              size="sm"
              className="max-w-[260px]"
              selectedKeys={[settings.readTargetType]}
              onChange={(e) => handleSelect('readTargetType', e.target.value)}
            >
              <SelectItem key="TEXT_ONLY" value="TEXT_ONLY">テキストのみ</SelectItem>
              <SelectItem key="TEXT_STICKER" value="TEXT_STICKER">テキスト + スタンプ</SelectItem>
              <SelectItem key="TEXT_STICKER_ATTACHMENT" value="TEXT_STICKER_ATTACHMENT">テキスト + スタンプ + 添付</SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>

      {/* 接続設定 */}
      <Card>
        <CardHeader className="font-semibold">接続設定</CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">自動接続</p>
              <p className="text-sm text-default-500">誰かが VC に参加したとき自動で接続する</p>
            </div>
            <Switch
              isSelected={settings.autoJoin}
              onValueChange={(v) => handleSwitch('autoJoin', v)}
            />
          </div>
          <Divider />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">デフォルト読み上げチャンネル ID</p>
              <p className="text-sm text-default-500">自動接続時に使用するテキストチャンネル</p>
            </div>
            <Input
              size="sm"
              placeholder="チャンネル ID"
              defaultValue={settings.defaultTextChannelId ?? ''}
              className="max-w-[200px]"
              onBlur={(e) => handleStringBlur('defaultTextChannelId', e.target.value)}
            />
          </div>
          <Divider />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">デフォルト話者 ID</p>
              <p className="text-sm text-default-500">ユーザー設定がない場合に使用する話者</p>
            </div>
            <Input
              type="number"
              size="sm"
              placeholder="話者 ID"
              defaultValue={settings.defaultSpeakerId != null ? String(settings.defaultSpeakerId) : ''}
              className="max-w-[120px]"
              onBlur={(e) => handleNumberBlur('defaultSpeakerId', e.target.value)}
            />
          </div>
        </CardBody>
      </Card>

      {/* 権限設定 */}
      <Card>
        <CardHeader className="font-semibold">権限設定</CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">管理ロール ID</p>
              <p className="text-sm text-default-500">このロールのユーザーを管理者として扱う</p>
            </div>
            <Input
              size="sm"
              placeholder="ロール ID"
              defaultValue={settings.adminRoleId ?? ''}
              className="max-w-[200px]"
              onBlur={(e) => handleStringBlur('adminRoleId', e.target.value)}
            />
          </div>
          <Divider />
          <div className="flex items-center justify-between">
            <p className="font-medium">サーバー辞書追加権限</p>
            <Select
              size="sm"
              className="max-w-[240px]"
              selectedKeys={[settings.dictPermission]}
              onChange={(e) => handleSelect('dictPermission', e.target.value)}
            >
              <SelectItem key="ALL_USERS" value="ALL_USERS">全ユーザー</SelectItem>
              <SelectItem key="ADMIN_ONLY" value="ADMIN_ONLY">管理者 / 指定ロールのみ</SelectItem>
            </Select>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
