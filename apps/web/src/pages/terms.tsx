import { motion } from 'framer-motion';

const SECTIONS = [
  {
    title: '第1条（適用）',
    content:
      '本規約は、SumireVox（以下「当サービス」）の利用に関する条件を定めるものです。ユーザーは本規約に同意した上で当サービスを利用するものとします。',
  },
  {
    title: '第2条（利用登録）',
    content: '準備中',
  },
  {
    title: '第3条（禁止事項）',
    content: '準備中',
  },
  {
    title: '第4条（サービスの提供の停止等）',
    content: '準備中',
  },
  {
    title: '第5条（免責事項）',
    content: '準備中',
  },
  {
    title: '第6条（利用規約の変更）',
    content: '準備中',
  },
];

export function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-2 mb-10"
      >
        <h1 className="text-4xl font-bold text-white">利用規約</h1>
        <p className="text-gray-500 text-sm">最終更新日: 2025年1月1日</p>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-gray-400 leading-relaxed mb-10"
      >
        SumireVox（以下「当サービス」）をご利用いただく前に、以下の利用規約をよくお読みください。
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
