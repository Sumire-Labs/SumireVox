import { PipelineStep } from '../types.js';

// ```で囲まれたコードブロック（複数行対応）
const CODE_BLOCK_PATTERN = /```[\s\S]*?```/g;

export const removeCodeBlock: PipelineStep = (text) => {
  return text.replace(CODE_BLOCK_PATTERN, 'コードブロック省略');
};
