import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';

export function CreditsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col gap-3 mb-12"
      >
        <h1 className="text-4xl font-bold text-white">クレジット</h1>
        <p className="text-gray-400">SumireVox で使用している音声合成エンジンのクレジット表記です。</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-[#12121a] border border-white/5 rounded-2xl p-8 flex flex-col gap-6"
      >
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-white">VOICEVOX</h2>
          <a
            href="https://voicevox.hiroshiba.jp/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors text-sm"
          >
            <ExternalLink size={14} />
            https://voicevox.hiroshiba.jp/
          </a>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col gap-4">
          <p className="text-gray-400 leading-relaxed">
            本 Bot は{' '}
            <a
              href="https://voicevox.hiroshiba.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              VOICEVOX
            </a>{' '}
            エンジンを使用して音声合成を行っています。
          </p>
          <p className="text-gray-400 leading-relaxed">
            VOICEVOX は無料で使える中品質なテキスト読み上げソフトウェアです。
            商用・非商用問わず無料で利用でき、各キャラクターの利用規約の範囲内で使用しています。
          </p>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-white">使用キャラクター</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            ※ 具体的な話者のクレジットは順次追加予定です。各キャラクターの利用規約については
            VOICEVOX 公式サイトをご確認ください。
          </p>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-white">ライセンスについて</h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            VOICEVOX の音声ライブラリは各キャラクターごとに利用規約が定められています。
            SumireVox での使用にあたっては、各キャラクターの利用規約を遵守しています。詳細は{' '}
            <a
              href="https://voicevox.hiroshiba.jp/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              VOICEVOX 公式サイト
            </a>{' '}
            をご参照ください。
          </p>
        </div>
      </motion.div>
    </div>
  );
}
