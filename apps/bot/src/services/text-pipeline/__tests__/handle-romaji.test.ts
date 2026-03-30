import { describe, it, expect } from 'vitest';
import { handleRomaji } from '../steps/handle-romaji.js';
import type { PipelineContext } from '../types.js';

// romajiReading: true のとき変換が有効
const ctx = { guildSettings: { romajiReading: true } } as unknown as PipelineContext;

describe('handleRomaji', () => {
  it('ローマ字をひらがなに変換する', () => {
    expect(handleRomaji('konnichiwa', ctx)).toBe('こんにちわ');
  });

  it('文中のローマ字を変換する', () => {
    const result = handleRomaji('今日はohayou', ctx);
    expect(result).toBe('今日はおはよう');
  });

  it('大文字のみの略語は変換しない', () => {
    expect(handleRomaji('API', ctx)).toBe('API');
    expect(handleRomaji('OK', ctx)).toBe('OK');
    expect(handleRomaji('URL', ctx)).toBe('URL');
  });

  it('1文字の英字は変換しない', () => {
    expect(handleRomaji('a', ctx)).toBe('a');
    expect(handleRomaji('I', ctx)).toBe('I');
  });

  it('混在テキストを正しく処理する', () => {
    const result = handleRomaji('sushi を食べた', ctx);
    expect(result).toBe('すし を食べた');
  });

  it('日本語のみのテキストはそのまま返す', () => {
    expect(handleRomaji('こんにちは', ctx)).toBe('こんにちは');
  });

  it('空文字列を処理できる', () => {
    expect(handleRomaji('', ctx)).toBe('');
  });

  it('romajiReading が false の場合は変換しない', () => {
    const skipCtx = { guildSettings: { romajiReading: false } } as unknown as PipelineContext;
    expect(handleRomaji('konnichiwa', skipCtx)).toBe('konnichiwa');
  });
});
