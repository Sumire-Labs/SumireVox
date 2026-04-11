import { PipelineStep } from '../types.js';

const NEWLINE_SEQUENCE_PATTERN = /[^\S\r\n]*(?:\r?\n)+[^\S\r\n]*/g;
const PUNCTUATION_PATTERN = /^[。、！？!?]$/;
const WHITESPACE_PATTERN = /\s/;

function findPreviousNonWhitespaceChar(text: string, index: number): string | null {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const char = text[cursor];
    if (char && !WHITESPACE_PATTERN.test(char)) {
      return char;
    }
  }

  return null;
}

function findNextNonWhitespaceChar(text: string, index: number): string | null {
  for (let cursor = index; cursor < text.length; cursor += 1) {
    const char = text[cursor];
    if (char && !WHITESPACE_PATTERN.test(char)) {
      return char;
    }
  }

  return null;
}

export const convertNewlineToPause: PipelineStep = (text, _context) => {
  return text.replace(NEWLINE_SEQUENCE_PATTERN, (match, offset, sourceText) => {
    const previousChar = findPreviousNonWhitespaceChar(sourceText, offset);
    const nextChar = findNextNonWhitespaceChar(sourceText, offset + match.length);

    if (
      (previousChar !== null && PUNCTUATION_PATTERN.test(previousChar)) ||
      (nextChar !== null && PUNCTUATION_PATTERN.test(nextChar))
    ) {
      return '';
    }

    return '。';
  });
};
