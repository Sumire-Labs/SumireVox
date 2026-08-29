import Markdown from 'react-markdown';
import type { Components } from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

const components: Components = {
  a: ({ href, children }) => {
    const external = href ? isExternalHttpUrl(href) : false;
    return (
      <a
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer noopener' : undefined}
        className="text-purple-300 underline decoration-purple-300/40 underline-offset-4 hover:text-purple-200"
      >
        {children}
      </a>
    );
  },
  img: ({ alt }) => (
    <span className="text-gray-400 italic">{alt || '画像'}</span>
  ),
};

function isExternalHttpUrl(href: string): boolean {
  try {
    const url = new URL(href, 'https://sumirevox.com');
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== 'https://sumirevox.com';
  } catch {
    return false;
  }
}

function transformUrl(url: string, key: string): string {
  if (key === 'src') return '';
  if (key !== 'href') return url;

  try {
    const parsedUrl = new URL(url, 'https://sumirevox.com');
    if (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'mailto:') {
      return url;
    }
  } catch {
    return '';
  }

  return '';
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  const containerClassName = ['markdown-content', className].filter(Boolean).join(' ');

  return (
    <div className={containerClassName}>
      <Markdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeSanitize]}
        skipHtml
        urlTransform={transformUrl}
        components={components}
      >
        {content}
      </Markdown>
    </div>
  );
}
