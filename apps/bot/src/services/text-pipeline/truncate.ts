/**
 * テキストを maxLength 以内に切り詰める。
 * suffix を付けても maxLength を超えない場合のみ suffix を付与する。
 * 結果は必ず maxLength 以下になることを保証する。
 */
export function truncateForSpeech(
  text: string,
  maxLength: number,
  suffix = '以下省略',
): string {
  if (maxLength <= 0) return '';
  if (text.length <= maxLength) return text;
  // suffix を付ける余地がない場合は本文をそのまま切る
  if (suffix.length >= maxLength) {
    return text.slice(0, maxLength);
  }
  const headLength = maxLength - suffix.length;
  return text.slice(0, headLength) + suffix;
}
