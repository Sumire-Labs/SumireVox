import { PipelineStep } from '../types.js';

const URL_PATTERN = /https?:\/\/[^\s<>]+/g;

export const removeUrl: PipelineStep = (text) => {
  return text.replace(URL_PATTERN, 'URL省略');
};
