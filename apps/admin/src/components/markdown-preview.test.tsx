import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownPreview } from './markdown-preview';

function renderMarkdown(content: string): string {
  return renderToStaticMarkup(<MarkdownPreview content={content} />);
}

describe('MarkdownPreview', () => {
  it('renders the same safe Markdown format used by the public site', () => {
    const html = renderMarkdown('### **プレビュー**\n1行目\n2行目\n\n~~古い情報~~');

    expect(html).toContain('<h3>');
    expect(html).toContain('<strong>プレビュー</strong>');
    expect(html).toContain('<br');
    expect(html).toContain('<del>古い情報</del>');
  });

  it('keeps unsafe content inert in the admin preview', () => {
    const html = renderMarkdown('<img src="https://tracker.example/pixel" onerror="alert(1)">\n\n[x](data:text/html,alert(1))');

    expect(html).not.toContain('<img');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('data:text/html');
  });
});
