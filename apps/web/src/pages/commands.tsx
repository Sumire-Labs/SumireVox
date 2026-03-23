import { Card, CardHeader, CardBody, Chip, Code } from '@heroui/react';

const COMMANDS = [
  {
    name: '/join',
    description: 'VC に参加し、コマンドを実行したテキストチャンネルを読み上げ対象に設定します。',
    usage: '/join',
    notes: [
      'ユーザーが VC に参加している必要があります',
      'Bot が別 VC に接続中の場合はエラーになります',
      'Bot が同じ VC に接続中の場合は読み上げチャンネルを切り替えます',
    ],
  },
  {
    name: '/leave',
    description: 'VC から退出します。即座にキューをクリアし、再生を中断して退出します。',
    usage: '/leave',
    notes: [
      '通常ユーザーは Bot と同じ VC に参加している必要があります',
      'ManageGuild 権限または管理ロールがあれば VC 未参加でも実行できます',
    ],
  },
  {
    name: '/voice',
    description: 'ユーザーごとの音声設定を管理します。設定は全サーバー共通です（PREMIUM サーバーで適用）。',
    usage: '/voice',
    notes: [
      '話者・速度（0.5〜2.0）・ピッチ（-0.15〜0.15）を設定できます',
      '設定の変更はどのサーバーでも可能ですが、適用は PREMIUM サーバーのみです',
      '話者一覧は VOICEVOX エンジンから動的に取得します',
    ],
  },
  {
    name: '/settings',
    description: 'サーバーの読み上げ設定を管理します。ManageGuild 権限または管理ロールが必要です。',
    usage: '/settings',
    notes: [
      '読み上げ設定、通知設定、フィルタ設定、接続設定、権限設定のカテゴリがあります',
      'FREE サーバーは最大文字数の変更不可（上限 50 文字固定）',
      'PREMIUM サーバーは最大文字数を最大 200 文字まで設定可能',
    ],
  },
  {
    name: '/dictionary',
    description: 'サーバー辞書とグローバル辞書を管理します。単語の読み方を登録して正しく読み上げさせます。',
    usage: '/dictionary',
    notes: [
      'サーバー辞書: FREE は 10 件、PREMIUM は 100 件まで登録可能',
      'グローバル辞書への申請は全ユーザーが可能です',
      '単語は最大 50 文字、読みは最大 100 文字（ひらがな・カタカナのみ）',
    ],
  },
  {
    name: '/help',
    description: 'コマンド一覧と概要を表示します。',
    usage: '/help',
    notes: [],
  },
];

export function CommandsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold">コマンド一覧</h1>
        <p className="text-default-500">SumireVox で使用できる全スラッシュコマンドの説明です。</p>
      </div>

      <div className="flex flex-col gap-4">
        {COMMANDS.map((cmd) => (
          <Card key={cmd.name} className="p-2">
            <CardHeader className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-3">
                <Code className="text-lg font-bold text-primary">{cmd.name}</Code>
              </div>
              <p className="text-default-600">{cmd.description}</p>
            </CardHeader>
            {cmd.notes.length > 0 && (
              <CardBody className="pt-0">
                <ul className="flex flex-col gap-1">
                  {cmd.notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-default-500">
                      <Chip size="sm" variant="dot" color="primary" className="mt-0.5 shrink-0" />
                      {note}
                    </li>
                  ))}
                </ul>
              </CardBody>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
