import { PipelineStep } from '../types.js';

const CHANNEL_MENTION_PATTERN = /<#(\d+)>/g;

export const convertChannelMention: PipelineStep = (text, context) => {
  return text.replace(CHANNEL_MENTION_PATTERN, (_, channelId) => {
    const channel = context.guild.channels.cache.get(channelId as string);
    return channel?.name ?? 'チャンネル';
  });
};
