import { PipelineStep } from '../types.js';

// 日本語文脈の「w」「ｗ」のみを変換する
// ASCII印字可能文字（0x21-0x7e）以外の文字の後に続く w/ｗ を対象とし、英単語中の w は無視する
// 大文字 W/Ｗ は英単語で頻出するため対象外

// 行末の w/ｗ（直前が非ASCII印字可能文字 or 行頭）
const W_END_OF_LINE = /(?<=[^\x21-\x7e]|^)[wｗ]+$/gm;
// 文中の w/ｗ（前後が非ASCII印字可能文字）
const W_INLINE = /(?<=[^\x21-\x7e])[wｗ]+(?=[^\x21-\x7e]|$)/g;

// 「草」→「くさ」（日本語文字の直後のみ）
const KUSA_PATTERN = /(?<=[ぁ-んァ-ヶー一-龥、。！？])(草+)/g;

function replaceW(match: string): string {
  return match.length >= 2 ? 'わらわら' : 'わら';
}

function replaceKusa(match: string): string {
  return match.length >= 2 ? 'くさくさ' : 'くさ';
}

export const convertWKusa: PipelineStep = (text) => {
  // 行末の w を先に処理
  let result = text.replace(W_END_OF_LINE, replaceW);
  // 文中の w を処理
  result = result.replace(W_INLINE, replaceW);
  // 草の変換（日本語文字の直後のみ）
  result = result.replace(KUSA_PATTERN, replaceKusa);
  return result;
};
