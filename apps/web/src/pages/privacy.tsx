import { motion } from 'framer-motion';

const SECTIONS = [
  {
    title: '1. 収集する情報',
    content:
      '当サービスでは、Discord OAuth2 認証を通じてユーザー ID、ユーザー名、参加サーバー一覧などの情報を取得します。また、サービス改善のためにアクセスログを収集する場合があります。',
  },
  {
    title: '2. 情報の利用目的',
    content: '準備中',
  },
  {
    title: '3. 情報の第三者提供',
    content: '準備中',
  },
  {
    title: '4. Cookie について',
    content: '準備中',
  },
  {
    title: '5. 情報の保管',
    content: '準備中',
  },
  {
    title: '6. お問い合わせ',
    content: '準備中',
  },
];

export function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-2 mb-10"
      >
        <h1 className="text-4xl font-bold text-white">プライバシーポリシー</h1>
        <p className="text-gray-500 text-sm">最終更新日: 2025年1月1日</p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-gray-400 leading-relaxed mb-10"
      >
        当サービスは、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
        本ポリシーでは、収集する情報の種類、利用方法、保護方法について説明します。
      </motion.p>

      <div className="flex flex-col gap-8">
        {SECTIONS.map((section, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.05 }}
            className="flex flex-col gap-3 pb-8 border-b border-white/5 last:border-0"
          >
            <h2 className="text-xl font-semibold text-white">{section.title}</h2>
            <p className="text-gray-400 leading-relaxed">{section.content}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
