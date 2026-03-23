import { describe, it, expect } from 'vitest';
import { validateDictionaryEntry } from '../validate-dictionary-entry.js';

describe('validateDictionaryEntry', () => {
  it('正常な単語と読みを検証成功する', () => {
    const result = validateDictionaryEntry('テスト', 'てすと');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('空文字の単語を拒否する', () => {
    const result = validateDictionaryEntry('', 'てすと');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('空白のみの単語を拒否する', () => {
    const result = validateDictionaryEntry('   ', 'てすと');
    expect(result.valid).toBe(false);
  });

  it('空文字の読みを拒否する', () => {
    const result = validateDictionaryEntry('テスト', '');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('最大文字数を超える単語を拒否する', () => {
    const longWord = 'あ'.repeat(51);
    const result = validateDictionaryEntry(longWord, 'てすと');
    expect(result.valid).toBe(false);
  });

  it('最大文字数ちょうどの単語は許可する', () => {
    const maxWord = 'あ'.repeat(50);
    const result = validateDictionaryEntry(maxWord, 'てすと');
    expect(result.valid).toBe(true);
  });

  it('最大文字数を超える読みを拒否する', () => {
    const longReading = 'あ'.repeat(101);
    const result = validateDictionaryEntry('テスト', longReading);
    expect(result.valid).toBe(false);
  });

  it('読みにひらがな・カタカナ以外が含まれる場合を拒否する', () => {
    const result = validateDictionaryEntry('test', 'てすとabc');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('カタカナの読みを許可する', () => {
    const result = validateDictionaryEntry('test', 'テスト');
    expect(result.valid).toBe(true);
  });

  it('長音符（ー）を含む読みを許可する', () => {
    const result = validateDictionaryEntry('user', 'ユーザー');
    expect(result.valid).toBe(true);
  });
});
