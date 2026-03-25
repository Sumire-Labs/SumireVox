import { describe, it, expect } from 'vitest';
import { handleStandardEmoji } from '../steps/handle-standard-emoji.js';
import { getEmojiCount } from '../emoji-dictionary.js';
import { PipelineContext } from '../types.js';

const dummyContext = {} as PipelineContext;

describe('handleStandardEmoji', () => {
  it('辞書が読み込まれている', () => {
    expect(getEmojiCount()).toBeGreaterThan(1000);
  });

  it('基本的な絵文字を日本語に変換する', () => {
    expect(handleStandardEmoji('😀', dummyContext)).toBe('にっこり笑う');
  });

  it('テキスト中の絵文字を変換する', () => {
    const result = handleStandardEmoji('こんにちは😊今日はいい天気🌞', dummyContext);
    expect(result).not.toMatch(/😊/);
    expect(result).not.toMatch(/🌞/);
    expect(result.length).toBeGreaterThan(0);
  });

  it('複数の絵文字を変換する', () => {
    const result = handleStandardEmoji('🎉🎊', dummyContext);
    expect(result).not.toMatch(/🎉/);
    expect(result).not.toMatch(/🎊/);
  });

  it('スキンモディファイア付き絵文字を変換する', () => {
    const result = handleStandardEmoji('👋🏻', dummyContext);
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toMatch(/👋/);
  });

  it('絵文字がないテキストはそのまま返す', () => {
    expect(handleStandardEmoji('こんにちは', dummyContext)).toBe('こんにちは');
  });

  it('空文字列はそのまま返す', () => {
    expect(handleStandardEmoji('', dummyContext)).toBe('');
  });

  it('テキストと絵文字が混在する場合、テキスト部分は保持される', () => {
    const result = handleStandardEmoji('テスト😀です', dummyContext);
    expect(result).toContain('テスト');
    expect(result).toContain('です');
    expect(result).not.toMatch(/😀/);
  });
});
