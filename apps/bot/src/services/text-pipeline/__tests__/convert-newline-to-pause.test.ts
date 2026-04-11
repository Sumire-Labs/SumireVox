import { describe, it, expect } from 'vitest';
import type { PipelineContext } from '../types.js';
import { convertNewlineToPause } from '../steps/convert-newline-to-pause.js';

const ctx = null as unknown as PipelineContext;

describe('convertNewlineToPause', () => {
  it('改行を句点に置換する', () => {
    expect(convertNewlineToPause('こんにちは\n今日は天気がいいですね', ctx)).toBe(
      'こんにちは。今日は天気がいいですね',
    );
  });

  it('連続改行を1つの句点にまとめる', () => {
    expect(convertNewlineToPause('一行目\n\n二行目', ctx)).toBe('一行目。二行目');
    expect(convertNewlineToPause('一行目\n\n\n二行目', ctx)).toBe('一行目。二行目');
  });

  it('改行前に句読点がある場合は句点を追加しない', () => {
    expect(convertNewlineToPause('こんにちは。\nさようなら', ctx)).toBe('こんにちは。さようなら');
    expect(convertNewlineToPause('やばい！\nマジで？', ctx)).toBe('やばい！マジで？');
    expect(convertNewlineToPause('確認？\n続き', ctx)).toBe('確認？続き');
    expect(convertNewlineToPause('wow!\nnext', ctx)).toBe('wow!next');
    expect(convertNewlineToPause('really?\nnext', ctx)).toBe('really?next');
    expect(convertNewlineToPause('区切り、\n続き', ctx)).toBe('区切り、続き');
  });

  it('改行後に句読点がある場合も句点を追加しない', () => {
    expect(convertNewlineToPause('前文\n。後文', ctx)).toBe('前文。後文');
    expect(convertNewlineToPause('前文\n、後文', ctx)).toBe('前文、後文');
  });

  it('改行がない場合はそのまま返す', () => {
    expect(convertNewlineToPause('改行なしテキスト', ctx)).toBe('改行なしテキスト');
  });

  it('改行前後の空白をトリムする', () => {
    expect(convertNewlineToPause('text \n text', ctx)).toBe('text。text');
    expect(convertNewlineToPause(' text\t\r\n\ttext ', ctx)).toBe(' text。text ');
  });

  it('空文字列を渡した場合はそのまま返す', () => {
    expect(convertNewlineToPause('', ctx)).toBe('');
  });

  it('CRLF も正しく処理する', () => {
    expect(convertNewlineToPause('テスト\r\n次の行', ctx)).toBe('テスト。次の行');
    expect(convertNewlineToPause('テスト\r\n\r\n次の行', ctx)).toBe('テスト。次の行');
  });
});
