import { PipelineStep } from '../types.js';

const INLINE_CODE_PATTERN = /`[^`]+`/g;

export const removeInlineCode: PipelineStep = (text) => {
  return text.replace(INLINE_CODE_PATTERN, 'コード省略');
};
