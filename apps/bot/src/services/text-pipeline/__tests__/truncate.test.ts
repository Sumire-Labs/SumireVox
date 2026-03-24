import { describe, it, expect } from 'vitest';
import { truncateForSpeech } from '../truncate.js';

describe('truncateForSpeech', () => {
  it('maxLength 以下のテキストはそのまま返る', () => {
    expect(truncateForSpeech('hello', 10)).toBe('hello');
  });

  it('maxLength と同じ長さのテキストはそのまま返る', () => {
    expect(truncateForSpeech('hello', 5)).toBe('hello');
  });

  it('空文字列はそのまま返る', () => {
    expect(truncateForSpeech('', 10)).toBe('');
  });

  it('maxLength 超過時、結果が maxLength ちょうどになる', () => {
    const result = truncateForSpeech('あいうえおかきくけこ', 8, '以下省略');
    expect(result.length).toBe(8);
  });

  it('suffix 分を引いた位置で切られている', () => {
    // 'あいうえおかきくけこ' = 10文字, maxLength=8, suffix='以下省略'(4文字)
    // headLength = 8 - 4 = 4 → 'あいうえ' + '以下省略'
    const result = truncateForSpeech('あいうえおかきくけこ', 8, '以下省略');
    expect(result).toBe('あいうえ以下省略');
  });

  it('maxLength が suffix より短い場合でも例外が出ない（headLength = 0）', () => {
    expect(() => truncateForSpeech('あいうえお', 2, '以下省略')).not.toThrow();
    const result = truncateForSpeech('あいうえお', 2, '以下省略');
    expect(result).toBe('以下省略');
  });

  it('カスタム suffix が正しく使われる', () => {
    const result = truncateForSpeech('abcdefghij', 7, '...');
    expect(result).toBe('abcd...');
    expect(result.length).toBe(7);
  });
});
