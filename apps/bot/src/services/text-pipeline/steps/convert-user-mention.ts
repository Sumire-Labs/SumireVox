import { PipelineStep } from '../types.js';

const USER_MENTION_PATTERN = /<@!?(\d+)>/g;

export const convertUserMention: PipelineStep = (text, context) => {
  return text.replace(USER_MENTION_PATTERN, (_, userId) => {
    const member = context.guild.members.cache.get(userId as string);
    const name = member?.displayName ?? 'ユーザー';
    return context.guildSettings.addSanSuffix ? `${name}さん` : name;
  });
};
