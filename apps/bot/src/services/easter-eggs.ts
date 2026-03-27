import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { logger } from '../infrastructure/logger.js';

interface EasterEgg {
  trigger: RegExp;
  audioFile: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));

// assets ディレクトリのパス（dist/services/ から見て ../../assets/）
const ASSETS_DIR = join(__dirname, '..', '..', 'assets', 'easter-eggs');

const EASTER_EGGS: EasterEgg[] = [
  {
    trigger: /^ｻｰﾓﾝ$/,
    audioFile: join(ASSETS_DIR, 'salmon.wav'),
  },
];

/**
 * テキストがイースターエッグに一致するか判定し、一致した場合は音声ファイルのパスを返す
 */
export function matchEasterEgg(text: string): string | null {
  const trimmed = text.trim();
  for (const egg of EASTER_EGGS) {
    if (egg.trigger.test(trimmed)) {
      if (existsSync(egg.audioFile)) {
        return egg.audioFile;
      }
      logger.warn({ file: egg.audioFile }, 'Easter egg audio file not found');
    }
  }
  return null;
}
