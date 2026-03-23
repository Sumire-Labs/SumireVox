import { describe, it, expect } from 'vitest';
import { createTrieNode, trieInsert, trieReplace, buildMergedTrie } from '../trie.js';

describe('Trie', () => {
  it('登録した単語を正しく置換する', () => {
    const root = createTrieNode();
    trieInsert(root, 'Discord', 'ディスコード');
    const result = trieReplace(root, 'Discordへようこそ');
    expect(result).toBe('ディスコードへようこそ');
  });

  it('最長一致で置換する', () => {
    const root = createTrieNode();
    trieInsert(root, 'Java', 'ジャバ');
    trieInsert(root, 'JavaScript', 'ジャバスクリプト');
    const result = trieReplace(root, 'JavaScriptとJavaは違います');
    expect(result).toBe('ジャバスクリプトとジャバは違います');
  });

  it('登録されていない文字列はそのまま返す', () => {
    const root = createTrieNode();
    trieInsert(root, 'test', 'テスト');
    const result = trieReplace(root, 'hello world');
    expect(result).toBe('hello world');
  });

  it('空文字列を処理できる', () => {
    const root = createTrieNode();
    const result = trieReplace(root, '');
    expect(result).toBe('');
  });

  it('エントリが空のトライでそのまま返す', () => {
    const root = createTrieNode();
    const result = trieReplace(root, 'なにも置換されない');
    expect(result).toBe('なにも置換されない');
  });

  it('同じ単語を複数回挿入した場合、後の読みで上書きされる', () => {
    const root = createTrieNode();
    trieInsert(root, 'w', 'わら');
    trieInsert(root, 'w', 'ダブリュー');
    const result = trieReplace(root, 'w');
    expect(result).toBe('ダブリュー');
  });

  it('テキスト末尾の単語も置換する', () => {
    const root = createTrieNode();
    trieInsert(root, 'end', 'エンド');
    const result = trieReplace(root, 'theend');
    expect(result).toBe('theエンド');
  });
});

describe('buildMergedTrie', () => {
  it('サーバー辞書がグローバル辞書より優先される', () => {
    const root = buildMergedTrie(
      [{ word: 'Discord', reading: 'サーバー辞書' }],
      [{ word: 'Discord', reading: 'グローバル辞書' }],
    );
    expect(trieReplace(root, 'Discord')).toBe('サーバー辞書');
  });

  it('サーバー辞書にない単語はグローバル辞書で置換される', () => {
    const root = buildMergedTrie(
      [{ word: 'server', reading: 'サーバー' }],
      [{ word: 'global', reading: 'グローバル' }],
    );
    expect(trieReplace(root, 'global')).toBe('グローバル');
    expect(trieReplace(root, 'server')).toBe('サーバー');
  });

  it('どちらの辞書にもない単語はそのまま', () => {
    const root = buildMergedTrie([], []);
    expect(trieReplace(root, 'unknown')).toBe('unknown');
  });
});
