import { PipelineStep } from '../types.js';

// <t:1234567890:R> 等のパターン
const TIMESTAMP_PATTERN = /<t:(\d+)(?::([tTdDfFR]))?>/g;

export const convertTimestamp: PipelineStep = (text) => {
  return text.replace(TIMESTAMP_PATTERN, (_, unixStr, format) => {
    const unix = parseInt(unixStr, 10);
    const date = new Date(unix * 1000);
    // フォーマットに応じた変換
    // デフォルト（format なし）は 'f' と同じ
    const fmt = (format as string) ?? 'f';
    switch (fmt) {
      case 't': // 短い時刻: 12時34分
        return formatTime(date, false);
      case 'T': // 長い時刻: 12時34分56秒
        return formatTime(date, true);
      case 'd': // 短い日付: 2024/1/15
        return formatDate(date, false);
      case 'D': // 長い日付: 2024年1月15日
        return formatDate(date, true);
      case 'f': // 短い日時: 2024年1月15日 12時34分
        return `${formatDate(date, true)} ${formatTime(date, false)}`;
      case 'F': // 長い日時: 2024年1月15日月曜日 12時34分
        return `${formatDate(date, true)}${formatWeekday(date)} ${formatTime(date, false)}`;
      case 'R': // 相対時刻: 「3時間前」等
        return formatRelative(date);
      default:
        return `${formatDate(date, true)} ${formatTime(date, false)}`;
    }
  });
};

function formatTime(date: Date, includeSeconds: boolean): string {
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  if (includeSeconds) {
    const s = date.getSeconds().toString().padStart(2, '0');
    return `${h}時${m}分${s}秒`;
  }
  return `${h}時${m}分`;
}

function formatDate(date: Date, long: boolean): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (long) {
    return `${y}年${m}月${d}日`;
  }
  return `${y}/${m}/${d}`;
}

function formatWeekday(date: Date): string {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  return weekdays[date.getDay()] + '曜日';
}

function formatRelative(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const absDiff = Math.abs(diff);
  const isPast = diff > 0;

  const seconds = Math.floor(absDiff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let text: string;
  if (days > 0) {
    text = `${days}日`;
  } else if (hours > 0) {
    text = `${hours}時間`;
  } else if (minutes > 0) {
    text = `${minutes}分`;
  } else {
    text = `${seconds}秒`;
  }

  return isPast ? `${text}前` : `${text}後`;
}
