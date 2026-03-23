import { PipelineStep } from '../types.js';

// ローマ字読み: ON の場合はそのまま残す（VOICEVOX がローマ字を読む）
// OFF の場合の処理は特にない（VOICEVOX に任せる）
// このステップは将来的にローマ字 → カタカナ変換を追加する場合のプレースホルダー
export const handleRomaji: PipelineStep = (text, _context) => {
  return text;
};
