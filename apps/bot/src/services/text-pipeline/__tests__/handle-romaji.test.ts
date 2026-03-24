import { describe, it, expect } from 'vitest';
import { handleRomaji } from '../steps/handle-romaji.js';
import type { PipelineContext } from '../types.js';

const dummyContext = {} as unknown as PipelineContext;

describe('handleRomaji', () => {
  it('ローマ字をひらがなに変換する', () => {
    expect(handleRomaji('konnichiwa', dummyContext)).toBe('こんにちわ');
  });

  it('文中のローマ字を変換する', () => {
    const result = handleRomaji('今日はohayou', dummyContext);
    expect(result).toBe('今日はおはよう');
  });

  it('大文字のみの略語は変換しない', () => {
    expect(handleRomaji('API', dummyContext)).toBe('API');
    expect(handleRomaji('OK', dummyContext)).toBe('OK');
    expect(handleRomaji('URL', dummyContext)).toBe('URL');
  });

  it('1文字の英字は変換しない', () => {
    expect(handleRomaji('a', dummyContext)).toBe('a');
    expect(handleRomaji('I', dummyContext)).toBe('I');
  });

  it('混在テキストを正しく処理する', () => {
    const result = handleRomaji('sushi を食べた', dummyContext);
    expect(result).toBe('すし を食べた');
  });

  it('日本語のみのテキストはそのまま返す', () => {
    expect(handleRomaji('こんにちは', dummyContext)).toBe('こんにちは');
  });

  it('空文字列を処理できる', () => {
    expect(handleRomaji('', dummyContext)).toBe('');
  });
});
