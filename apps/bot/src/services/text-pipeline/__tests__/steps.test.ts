import { describe, it, expect } from 'vitest';
import type { PipelineContext } from '../types.js';
import { removeUrl } from '../steps/remove-url.js';
import { removeCodeBlock } from '../steps/remove-code-block.js';
import { removeInlineCode } from '../steps/remove-inline-code.js';
import { removeSpoiler } from '../steps/remove-spoiler.js';
import { convertWKusa } from '../steps/convert-w-kusa.js';

// 各ステップは context を参照しないのでキャストして渡す
const ctx = null as unknown as PipelineContext;

describe('removeUrl', () => {
  it('https URL を「URL省略」に置換する', () => {
    expect(removeUrl('https://example.com を見てください', ctx)).toContain('URL省略');
  });

  it('http URL を「URL省略」に置換する', () => {
    expect(removeUrl('http://example.com', ctx)).toBe('URL省略');
  });

  it('複数の URL を全て置換する', () => {
    const result = removeUrl('https://a.com と https://b.com', ctx);
    expect(result).toBe('URL省略 と URL省略');
  });

  it('URL がない場合はそのまま返す', () => {
    expect(removeUrl('URLなしテキスト', ctx)).toBe('URLなしテキスト');
  });
});

describe('removeCodeBlock', () => {
  it('コードブロックを「コードブロック省略」に置換する', () => {
    const input = '```js\nconsole.log("hello")\n```';
    expect(removeCodeBlock(input, ctx)).toBe('コードブロック省略');
  });

  it('言語指定なしコードブロックも置換する', () => {
    expect(removeCodeBlock('```test```', ctx)).toBe('コードブロック省略');
  });

  it('コードブロックがない場合はそのまま返す', () => {
    expect(removeCodeBlock('普通のテキスト', ctx)).toBe('普通のテキスト');
  });
});

describe('removeInlineCode', () => {
  it('インラインコードを「コード省略」に置換する', () => {
    expect(removeInlineCode('`const x = 1` を実行', ctx)).toContain('コード省略');
  });

  it('複数のインラインコードを全て置換する', () => {
    const result = removeInlineCode('`foo` と `bar`', ctx);
    expect(result).toBe('コード省略 と コード省略');
  });

  it('インラインコードがない場合はそのまま返す', () => {
    expect(removeInlineCode('普通のテキスト', ctx)).toBe('普通のテキスト');
  });
});

describe('removeSpoiler', () => {
  it('スポイラーを除去する', () => {
    const result = removeSpoiler('これは||ネタバレ||です', ctx);
    expect(result).toBe('これはです');
    expect(result).not.toContain('||');
  });

  it('複数のスポイラーを全て除去する', () => {
    const result = removeSpoiler('||A|| と ||B||', ctx);
    expect(result).toBe(' と ');
  });

  it('スポイラーがない場合はそのまま返す', () => {
    expect(removeSpoiler('普通のテキスト', ctx)).toBe('普通のテキスト');
  });
});

describe('convertWKusa', () => {
  it('単独の w を「わら」に変換する', () => {
    expect(convertWKusa('面白いw', ctx)).toBe('面白いわら');
  });

  it('2つ以上の w を「わらわら」に変換する', () => {
    expect(convertWKusa('面白いww', ctx)).toBe('面白いわらわら');
    expect(convertWKusa('面白いwww', ctx)).toBe('面白いわらわら');
  });

  it('全角ｗも変換する', () => {
    expect(convertWKusa('ｗ', ctx)).toBe('わら');
    expect(convertWKusa('ｗｗ', ctx)).toBe('わらわら');
  });

  it('大文字 W は英単語で頻出するため変換しない', () => {
    expect(convertWKusa('W', ctx)).toBe('W');
    expect(convertWKusa('WW', ctx)).toBe('WW');
  });

  it('草を「くさ」に変換する（日本語文字の直後のみ）', () => {
    expect(convertWKusa('面白い草', ctx)).toBe('面白いくさ');
  });

  it('草が単独の場合は変換しない', () => {
    expect(convertWKusa('草', ctx)).toBe('草');
  });

  it('日本語文脈の w と草を両方変換する', () => {
    // 日本語文字に続く w → 変換される
    expect(convertWKusa('面白いww草', ctx)).toBe('面白いわらわらくさ');
  });

  it('英単語中の w は変換しない', () => {
    expect(convertWKusa('window', ctx)).toBe('window');
    expect(convertWKusa('www.google.com', ctx)).toBe('www.google.com');
    expect(convertWKusa('wow', ctx)).toBe('wow');
    expect(convertWKusa('Hello World', ctx)).toBe('Hello World');
  });

  it('笑ったw次の話w のように文中の w を変換する', () => {
    expect(convertWKusa('笑ったw次の話w', ctx)).toBe('笑ったわら次の話わら');
  });

  it('どちらもない場合はそのまま返す', () => {
    expect(convertWKusa('普通のテキスト', ctx)).toBe('普通のテキスト');
  });
});
