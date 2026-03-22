import { PipelineStep } from '../types.js';

// 「w」系の変換（半角w, 全角ｗ, 大文字W, 全角Ｗ）
// 2つ以上連続 → 「わらわら」、1つ → 「わら」
const W_MULTIPLE_PATTERN = /[wWｗＷ]{2,}/g;
const W_SINGLE_PATTERN = /[wWｗＷ]/g;

// 「草」→「くさ」
const KUSA_PATTERN = /草/g;

export const convertWKusa: PipelineStep = (text) => {
  // 先に2つ以上を置換（1つの置換より先に処理しないと「わらわら」にならない）
  let result = text.replace(W_MULTIPLE_PATTERN, 'わらわら');
  result = result.replace(W_SINGLE_PATTERN, 'わら');
  result = result.replace(KUSA_PATTERN, 'くさ');
  return result;
};
