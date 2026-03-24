/**
 * テキストを maxLength 以内に切り詰める。
 * suffix 分を差し引いてから切るため、結果は必ず maxLength 以下になる。
 */
export function truncateForSpeech(text: string, maxLength: number, suffix = '以下省略'): string {
  if (text.length <= maxLength) return text;
  const headLength = Math.max(0, maxLength - suffix.length);
  return text.slice(0, headLength) + suffix;
}
