import { PipelineStep } from '../types.js';

const SPOILER_PATTERN = /\|\|[\s\S]*?\|\|/g;

export const removeSpoiler: PipelineStep = (text) => {
  return text.replace(SPOILER_PATTERN, '');
};
