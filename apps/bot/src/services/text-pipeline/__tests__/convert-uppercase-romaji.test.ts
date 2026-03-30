import { describe, it, expect } from 'vitest';
import { convertUppercaseRomaji } from '../steps/convert-uppercase-romaji.js';
import type { PipelineContext } from '../types.js';

// uppercaseReading: true のとき変換が有効
const ctx = { guildSettings: { uppercaseReading: true } } as unknown as PipelineContext;

describe('convertUppercaseRomaji', () => {
  it('全大文字のローマ字をひらがなに変換する', () => {
    expect(convertUppercaseRomaji('API', ctx)).toBe('あぴ');
    expect(convertUppercaseRomaji('NANI', ctx)).toBe('なに');
  });

  it('文中の全大文字列を変換する', () => {
    const result = convertUppercaseRomaji('これは NASA の話', ctx);
    expect(result).toBe('これは なさ の話');
  });

  it('複数の全大文字列を全て変換する', () => {
    const result = convertUppercaseRomaji('SUSHI と SOBA', ctx);
    expect(result).toBe('すし と そば');
  });

  it('ローマ字として変換できない語は変換せず元の文字列を返す', () => {
    // "ok" → "おk" のようにアルファベットが残る場合は変換失敗として元の文字列を返す
    expect(convertUppercaseRomaji('OK', ctx)).toBe('OK');
    expect(convertUppercaseRomaji('CPU', ctx)).toBe('CPU');
  });

  it('1文字の大文字は変換しない (2文字以上が対象)', () => {
    expect(convertUppercaseRomaji('A', ctx)).toBe('A');
    expect(convertUppercaseRomaji('I', ctx)).toBe('I');
  });

  it('小文字混じりの単語は変換しない', () => {
    expect(convertUppercaseRomaji('Hello', ctx)).toBe('Hello');
    expect(convertUppercaseRomaji('JavaScript', ctx)).toBe('JavaScript');
  });

  it('日本語のみのテキストはそのまま返す', () => {
    expect(convertUppercaseRomaji('こんにちは', ctx)).toBe('こんにちは');
  });

  it('空文字列を処理できる', () => {
    expect(convertUppercaseRomaji('', ctx)).toBe('');
  });

  it('uppercaseReading が false の場合は変換しない', () => {
    const skipCtx = { guildSettings: { uppercaseReading: false } } as unknown as PipelineContext;
    expect(convertUppercaseRomaji('API', skipCtx)).toBe('API');
    expect(convertUppercaseRomaji('NANI', skipCtx)).toBe('NANI');
  });
});
