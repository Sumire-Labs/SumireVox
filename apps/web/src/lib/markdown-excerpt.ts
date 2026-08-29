const EXCERPT_LENGTH = 160;

export function getMarkdownExcerpt(body: string): string {
  const excerpt = body
    .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')
    .replace(/<((?:https?:\/\/|mailto:)[^>\s]+)>/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm, '')
    .replace(/\[[ xX]\]\s*/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return excerpt.length > EXCERPT_LENGTH ? `${excerpt.slice(0, EXCERPT_LENGTH)}…` : excerpt;
}
