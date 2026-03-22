import { PipelineStep } from '../types.js';

// カンマ区切り数字: 1,000 → 1000（VOICEVOX が数字を読める）
const COMMA_NUMBER_PATTERN = /(\d{1,3}(?:,\d{3})+)/g;

// 一般的な英略語・単位の変換
const UNIT_MAP: [RegExp, string][] = [
  [/\bkg\b/gi, 'キログラム'],
  [/\bmg\b/gi, 'ミリグラム'],
  [/\bkm\b/gi, 'キロメートル'],
  [/\bcm\b/gi, 'センチメートル'],
  [/\bmm\b/gi, 'ミリメートル'],
  [/\bg\b/gi, 'グラム'],
  [/\bm\b/gi, 'メートル'],
  [/\bkb\b/gi, 'キロバイト'],
  [/\bmb\b/gi, 'メガバイト'],
  [/\bgb\b/gi, 'ギガバイト'],
  [/\btb\b/gi, 'テラバイト'],
  [/\bDPI\b/g, 'ディーピーアイ'],
  [/\bFPS\b/g, 'エフピーエス'],
  [/\bGG\b/g, 'ジージー'],
  [/\bDM\b/g, 'ディーエム'],
  [/\bVC\b/g, 'ブイシー'],
  [/\bHP\b/g, 'エイチピー'],
  [/\bMP\b/g, 'エムピー'],
  [/\bPC\b/g, 'ピーシー'],
  [/\bOK\b/gi, 'オーケー'],
  [/\bNG\b/gi, 'エヌジー'],
  [/\bBGM\b/gi, 'ビージーエム'],
  [/\bSNS\b/gi, 'エスエヌエス'],
  [/\bURL\b/gi, 'ユーアールエル'],
  [/\bID\b/g, 'アイディー'],
  [/\bAI\b/g, 'エーアイ'],
  [/\bAPI\b/g, 'エーピーアイ'],
  [/\bUI\b/g, 'ユーアイ'],
  [/\bUX\b/g, 'ユーエックス'],
  [/\bvs\.?\b/gi, 'バーサス'],
];

export const optimizeNumbersAndUnits: PipelineStep = (text) => {
  // カンマ区切り数字のカンマを除去
  let result = text.replace(COMMA_NUMBER_PATTERN, (match) => match.replace(/,/g, ''));
  // 単位・略語の変換
  for (const [pattern, replacement] of UNIT_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result;
};
