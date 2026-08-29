import { describe, expect, it } from 'vitest';
import { getMarkdownExcerpt } from './markdown-excerpt';

describe('getMarkdownExcerpt', () => {
  it('converts common Markdown syntax to a readable plain-text excerpt', () => {
    const excerpt = getMarkdownExcerpt([
      '# 見出し',
      '',
      '**重要**な[お知らせ](https://example.com)です。',
      '- [x] 完了した項目',
      '- `コード`',
    ].join('\n'));

    expect(excerpt).toBe('見出し 重要なお知らせです。 完了した項目 コード');
  });

  it('keeps the existing length limit and appends an ellipsis', () => {
    const excerpt = getMarkdownExcerpt('あ'.repeat(161));

    expect(excerpt).toBe(`${'あ'.repeat(160)}…`);
  });

  it('handles empty and whitespace-only content', () => {
    expect(getMarkdownExcerpt('')).toBe('');
    expect(getMarkdownExcerpt('  \n\t')).toBe('');
  });
});
