import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './markdown-content';

function renderMarkdown(content: string): string {
  return renderToStaticMarkup(<MarkdownContent content={content} />);
}

describe('MarkdownContent', () => {
  it('renders GFM syntax and preserves single line breaks', () => {
    const html = renderMarkdown([
      '## 更新内容',
      '',
      '**重要**な変更です。',
      '次の行です。',
      '',
      '| 項目 | 内容 |',
      '| --- | --- |',
      '| A | B |',
      '',
      '- [x] 完了',
      '- [ ] 未完了',
      '',
      '```ts',
      'const answer = 42;',
      '```',
    ].join('\n'));

    expect(html).toContain('<h2>更新内容</h2>');
    expect(html).toContain('<strong>重要</strong>');
    expect(html).toContain('<br');
    expect(html).toContain('<table>');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('language-ts');
  });

  it('does not render raw HTML or dangerous links', () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n[危険](javascript:alert(1))');

    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('危険');
  });

  it('renders safe external links with secure target attributes', () => {
    const html = renderMarkdown('[公式サイト](https://example.com)');

    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer noopener"');
  });

  it('does not create an image element for Markdown images', () => {
    const html = renderMarkdown('![ロゴ](https://example.com/logo.png)');

    expect(html).not.toContain('<img');
    expect(html).toContain('ロゴ');
  });
});
