import { motion } from 'framer-motion';

const COMMANDS = [
  {
    name: '/join',
    description: 'VC に参加し、コマンドを実行したテキストチャンネルを読み上げ対象に設定します。',
    notes: [
      'ユーザーが VC に参加している必要があります',
      'Bot が別 VC に接続中の場合はエラーになります',
      'Bot が同じ VC に接続中の場合は読み上げチャンネルを切り替えます',
    ],
  },
  {
    name: '/leave',
    description: 'VC から退出します。即座にキューをクリアし、再生を中断して退出します。',
    notes: [
      '通常ユーザーは Bot と同じ VC に参加している必要があります',
      'ManageGuild 権限または管理ロールがあれば VC 未参加でも実行できます',
    ],
  },
  {
    name: '/voice',
    description: 'ユーザーごとの音声設定を管理します。設定は全サーバー共通です（PREMIUM サーバーで適用）。',
    notes: [
      '話者・速度（0.5〜2.0）・ピッチ（-0.15〜0.15）を設定できます',
      '設定の変更はどのサーバーでも可能ですが、適用は PREMIUM サーバーのみです',
      '話者一覧は VOICEVOX エンジンから動的に取得します',
    ],
  },
  {
    name: '/settings',
    description: 'サーバーの読み上げ設定を管理します。ManageGuild 権限または管理ロールが必要です。',
    notes: [
      '読み上げ設定、通知設定、フィルタ設定、接続設定、権限設定のカテゴリがあります',
      'FREE サーバーは最大文字数の変更不可（上限 50 文字固定）',
      'PREMIUM サーバーは最大文字数を最大 200 文字まで設定可能',
    ],
  },
  {
    name: '/dictionary',
    description: 'サーバー辞書とグローバル辞書を管理します。単語の読み方を登録して正しく読み上げさせます。',
    notes: [
      'サーバー辞書: FREE は 10 件、PREMIUM は 100 件まで登録可能',
      'グローバル辞書への申請は全ユーザーが可能です',
      '単語は最大 50 文字、読みは最大 100 文字（ひらがな・カタカナのみ）',
    ],
  },
  {
    name: '/help',
    description: 'コマンド一覧と概要を表示します。',
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
