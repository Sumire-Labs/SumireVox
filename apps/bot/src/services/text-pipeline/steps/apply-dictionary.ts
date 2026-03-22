import { PipelineStep } from '../types.js';
import { trieReplace } from '../trie.js';

export const applyDictionary: PipelineStep = (text, context) => {
  if (!context.dictionaryTrie) return text;
  return trieReplace(context.dictionaryTrie, text);
};
