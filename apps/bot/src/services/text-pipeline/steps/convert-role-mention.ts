import { PipelineStep } from '../types.js';

const ROLE_MENTION_PATTERN = /<@&(\d+)>/g;

export const convertRoleMention: PipelineStep = (text, context) => {
  return text.replace(ROLE_MENTION_PATTERN, (_, roleId) => {
    const role = context.guild.roles.cache.get(roleId as string);
    return role?.name ?? 'ロール';
  });
};
