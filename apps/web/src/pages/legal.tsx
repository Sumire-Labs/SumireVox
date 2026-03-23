import { motion } from 'framer-motion';

const ITEMS = [
  { label: '販売業者', value: '準備中' },
  { label: '運営責任者', value: '準備中' },
  { label: '所在地', value: '準備中' },
  { label: 'メールアドレス', value: '準備中' },
  { label: '販売価格', value: 'ブースト: 月額300円（税込）' },
  { label: '支払い方法', value: 'クレジットカード（Stripe 経由）' },
  { label: '支払い時期', value: '月次自動更新' },
  { label: '役務の提供時期', value: '決済完了後、即時' },
  { label: 'キャンセル・解約について', value: 'ダッシュボードよりいつでも解約可能。解約後も当月末まで有効。' },
  { label: '返金について', value: '準備中' },
  { label: '動作環境', value: 'Discord クライアント（PC・モバイル）' },
];

export function LegalPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-2 mb-10"
      >
        <h1 className="text-4xl font-bold text-white">特定商取引法に基づく表記</h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-[#12121a] border border-white/5 rounded-2xl overflow-hidden"
      >
        {ITEMS.map((item, i) => (
          <div
            key={item.label}
            className={`flex flex-col sm:flex-row gap-2 sm:gap-8 px-6 py-4 ${
              i < ITEMS.length - 1 ? 'border-b border-white/5' : ''
            }`}
          >
            <span className="text-sm font-medium text-gray-300 whitespace-nowrap sm:w-48 shrink-0">
              {item.label}
            </span>
            <span className="text-sm text-gray-400 leading-relaxed">{item.value}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
