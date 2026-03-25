import { describe, it, expect } from 'vitest';
import { truncateForSpeech } from '../truncate.js';

describe('truncateForSpeech', () => {
  it('maxLength 以下のテキストはそのまま返る', () => {
    const result = truncateForSpeech('hello', 10);
    expect(result).toBe('hello');
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('maxLength と同じ長さのテキストはそのまま返る', () => {
    const result = truncateForSpeech('hello', 5);
    expect(result).toBe('hello');
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it('空文字列はそのまま返る', () => {
    const result = truncateForSpeech('', 10);
    expect(result).toBe('');
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it('maxLength 超過時、結果が maxLength ちょうどになる', () => {
    const result = truncateForSpeech('あいうえおかきくけこ', 8, '以下省略');
    expect(result.length).toBe(8);
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it('suffix 分を引いた位置で切られている', () => {
    // 'あいうえおかきくけこ' = 10文字, maxLength=8, suffix='以下省略'(4文字)
    // headLength = 8 - 4 = 4 → 'あいうえ' + '以下省略'
    const result = truncateForSpeech('あいうえおかきくけこ', 8, '以下省略');
    expect(result).toBe('あいうえ以下省略');
    expect(result.length).toBeLessThanOrEqual(8);
  });

  it('maxLength が suffix より短い場合、suffix なしで本文を切り詰める', () => {
    const result = truncateForSpeech('あいうえお', 2, '以下省略');
    expect(result.length).toBeLessThanOrEqual(2);
    expect(result).toBe('あい');
  });

  it('maxLength が 0 の場合、空文字を返す', () => {
    const result = truncateForSpeech('あいうえお', 0, '以下省略');
    expect(result).toBe('');
    expect(result.length).toBeLessThanOrEqual(0);
  });

  it('maxLength が負の場合、空文字を返す', () => {
    const result = truncateForSpeech('あいうえお', -5);
    expect(result).toBe('');
  });

  it('カスタム suffix が正しく使われる', () => {
    const result = truncateForSpeech('abcdefghij', 7, '...');
    expect(result).toBe('abcd...');
    expect(result.length).toBe(7);
    expect(result.length).toBeLessThanOrEqual(7);
  });
});
