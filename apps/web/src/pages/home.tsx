import { Link } from 'react-router';
import { motion } from 'framer-motion';
import { Mic, BookOpen, Terminal, Sparkles, Check } from 'lucide-react';

const FEATURES = [
  {
    icon: Mic,
    title: '高品質な音声合成',
    description:
      'VOICEVOX エンジンによる自然な日本語音声。複数の話者から好みの声を選べます。速度やピッチも細かく調整可能です。',
  },
  {
    icon: BookOpen,
    title: 'サーバー辞書でカスタマイズ',
    description:
      'サーバー専用の読み方辞書を登録できます。独特の用語や固有名詞も正しく読み上げます。グローバル辞書への申請機能も搭載。',
  },
  {
    icon: Terminal,
    title: '直感的なコマンド操作',
    description:
      'スラッシュコマンドで簡単操作。/join で読み上げ開始、/leave で終了。設定は UI でインタラクティブに変更できます。',
  },
  {
    icon: Sparkles,
    title: 'PREMIUM でさらに拡張',
    description:
      '月額300円のブーストでサーバーを PREMIUM に。読み上げ最大文字数が50→200文字に拡張、ユーザーごとの音声設定が適用されます。',
  },
];

const FREE_FEATURES = [
  '読み上げ最大 50 文字',
  'サーバーデフォルト話者',
  'サーバー辞書 10 エントリ',
  '入退室通知',
  '自動接続',
];

const PREMIUM_FEATURES = [
  '読み上げ最大 200 文字',
  'ユーザーごとの話者・速度・ピッチ設定',
  'サーバー辞書 100 エントリ',
  '入退室通知',
  '自動接続',
  '優先サポート',
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.1 },
  }),
};

export function HomePage() {
  return (
    <div className="flex flex-col">
      {/* ── Hero ── */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center text-center px-4 md:px-8 overflow-hidden">
        {/* Background orbs */}
        <div
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />

        <div className="relative flex flex-col items-center gap-6 max-w-4xl">
          <motion.p
            custom={0}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-sm tracking-widest uppercase font-medium"
            style={{ color: 'var(--color-primary-light)' }}
          >
            Discord 読み上げ Bot
          </motion.p>

          <motion.h1
            custom={1}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-4xl md:text-6xl lg:text-7xl font-bold leading-tight tracking-tight"
          >
            Discord のテキストを
            <br />
            <span className="gradient-text">高品質な音声</span>に
          </motion.h1>

          <motion.p
            custom={2}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="text-lg text-gray-400 max-w-2xl leading-relaxed"
          >
            SumireVox は VOICEVOX エンジンを使った Discord 読み上げ Bot です。
            サーバーのテキストチャンネルのメッセージをリアルタイムで音声合成し、VC に流します。
          </motion.p>

          <motion.div
            custom={3}
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            className="flex gap-4 flex-wrap justify-center"
          >
            <a
              href="#"
              className="gradient-bg text-white font-semibold px-8 py-3 rounded-xl transition-all hover:opacity-90 hover:scale-105"
            >
              Bot を導入する
            </a>
            <Link
              to="/dashboard"
              className="text-white font-medium px-8 py-3 rounded-xl transition-all hover:bg-white/10 border border-white/20 bg-white/5"
            >
              ダッシュボード
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-center text-white"
          >
            特徴
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="bg-[#12121a] border border-white/5 rounded-2xl p-8 hover:border-purple-500/30 transition-all duration-300"
                >
                  <Icon className="w-10 h-10 text-purple-400 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="py-24 px-4 md:px-8">
        <div className="max-w-6xl mx-auto flex flex-col gap-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-center text-white"
          >
            料金プラン
          </motion.h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
            {/* FREE */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0 }}
              className="bg-[#12121a] border border-white/10 rounded-2xl p-8 flex flex-col gap-6"
            >
              <div>
                <p className="text-sm text-gray-400 font-medium mb-2">FREE</p>
                <p className="text-4xl font-bold text-white">無料</p>
              </div>
              <ul className="flex flex-col gap-3 flex-1">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-gray-300 text-sm">
                    <Check className="w-4 h-4 text-gray-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#"
                className="block text-center text-white border border-white/20 bg-white/5 hover:bg-white/10 font-medium px-6 py-3 rounded-xl transition-all"
              >
                Bot を導入する
              </a>
            </motion.div>

            {/* PREMIUM */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glow-purple bg-gradient-to-br from-purple-900/30 to-blue-900/20 border border-purple-500/30 rounded-2xl p-8 flex flex-col gap-6"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-purple-300 font-medium">PREMIUM</p>
                  <span className="bg-purple-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                    おすすめ
                  </span>
                </div>
                <div>
                  <span className="text-4xl font-bold gradient-text">¥300</span>
                  <span className="text-gray-400 text-sm ml-2">/ ブースト / 月</span>
                </div>
              </div>
              <ul className="flex flex-col gap-3 flex-1">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-gray-200 text-sm">
                    <Check className="w-4 h-4 text-purple-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/auth/login"
                className="gradient-bg block text-center text-white font-semibold px-6 py-3 rounded-xl transition-all hover:opacity-90"
              >
                ログインしてブーストを購入
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-24 px-4 md:px-8 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(124,58,237,0.12) 0%, transparent 70%)',
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="relative max-w-2xl mx-auto flex flex-col items-center text-center gap-6"
        >
          <h2 className="text-3xl font-bold text-white">今すぐ SumireVox を導入しよう</h2>
          <p className="text-gray-400">完全無料で始められます</p>
          <a
            href="#"
            className="gradient-bg text-white font-semibold px-10 py-4 rounded-xl text-lg transition-all hover:opacity-90 hover:scale-105"
          >
            Bot を導入する
          </a>
        </motion.div>
      </section>
    </div>
  );
}
