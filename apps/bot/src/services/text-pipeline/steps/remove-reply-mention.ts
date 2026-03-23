import { PipelineStep } from '../types.js';

export const removeReplyMention: PipelineStep = (text, context) => {
  if (!context.hasReference || !context.repliedUserId) return text;
  // メッセージ先頭の返信先ユーザーメンションを除去
  const pattern = new RegExp(`^<@!?${context.repliedUserId}>\\s*`);
  return text.replace(pattern, '');
};
