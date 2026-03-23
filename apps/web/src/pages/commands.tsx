import { motion } from 'framer-motion';

const COMMANDS = [
  {
    name: '/join',
    description:
      'あなたが参加している VC に Bot を接続します。テキストチャンネルのメッセージがリアルタイムで読み上げられます。',
    notes: [
      'ユーザーが VC に参加している必要があります',
      'Bot が別 VC に接続中の場合はエラーになります',
      'Bot が同じ VC に接続中の場合は読み上げチャンネルを切り替えます',
    ],
  },
  {
    name: '/leave',
    description: 'Bot を VC から退出させます。同じ VC にいるか、管理者権限が必要です。',
    notes: [
      '通常ユーザーは Bot と同じ VC に参加している必要があります',
      'ManageGuild 権限または管理ロールがあれば VC 未参加でも実行できます',
    ],
  },
  {
    name: '/voice',
    description:
      '話者・読み上げ速度・ピッチを設定します。PREMIUM サーバーではユーザーごとに個別設定が可能です。',
    notes: [
      '話者・速度（0.5〜2.0）・ピッチ（-0.15〜0.15）を設定できます',
      '設定の変更はどのサーバーでも可能ですが、適用は PREMIUM サーバーのみです',
      '話者一覧は VOICEVOX エンジンから動的に取得します',
    ],
  },
  {
    name: '/settings',
    description:
      'サーバーの読み上げ設定を管理します。読み上げ対象チャンネル、通知、フィルターなどを設定できます。管理者権限が必要です。',
    notes: [
      '読み上げ設定、通知設定、フィルタ設定、接続設定、権限設定のカテゴリがあります',
      'FREE サーバーは最大文字数の変更不可（上限 50 文字固定）',
      'PREMIUM サーバーは最大文字数を最大 200 文字まで設定可能',
    ],
  },
  {
    name: '/dictionary',
    description:
      'サーバー辞書の追加・削除・確認ができます。グローバル辞書への申請も可能です。',
    notes: [
      'サーバー辞書: FREE は 10 件、PREMIUM は 100 件まで登録可能',
      'グローバル辞書への申請は全ユーザーが可能です',
      '単語は最大 50 文字、読みは最大 100 文字（ひらがな・カタカナのみ）',
    ],
  },
  {
    name: '/help',
    description: 'Bot の使い方やリンク集を表示します。',
    notes: [],
  },
];

export function CommandsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-3 mb-12"
      >
        <h1 className="text-4xl font-bold text-white">コマンド一覧</h1>
        <p className="text-gray-400">SumireVox で使用できる全スラッシュコマンドの説明です。</p>
        <p className="text-gray-400 text-center mb-10">スラッシュコマンドで簡単に操作できます</p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {COMMANDS.map((cmd, i) => (
          <motion.div
            key={cmd.name}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: i * 0.07 }}
            className="bg-[#12121a] border border-white/5 rounded-2xl p-6 hover:border-purple-500/30 transition-all duration-300 flex flex-col gap-3"
          >
            <span className="text-lg font-mono font-bold text-purple-400">{cmd.name}</span>
            <p className="text-gray-400 text-sm leading-relaxed">{cmd.description}</p>
            {cmd.notes.length > 0 && (
              <ul className="flex flex-col gap-2 mt-1">
                {cmd.notes.map((note, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-gray-500">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500/60 shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
