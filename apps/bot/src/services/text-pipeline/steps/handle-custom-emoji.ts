import { PipelineStep } from '../types.js';

// <:emoji_name:123456789> または <a:emoji_name:123456789>（アニメーション）
const CUSTOM_EMOJI_PATTERN = /<a?:(\w+):\d+>/g;

export const handleCustomEmoji: PipelineStep = (text, context) => {
  if (context.guildSettings.customEmojiHandling === 'remove') {
    return text.replace(CUSTOM_EMOJI_PATTERN, '');
  }
  // 'read_name': 絵文字名を読み上げ
  return text.replace(CUSTOM_EMOJI_PATTERN, (_, name) => name as string);
};
