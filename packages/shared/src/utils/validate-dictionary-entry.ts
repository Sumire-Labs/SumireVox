import { LIMITS } from '../constants/limits.js';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

const KANA_ONLY_PATTERN = /^[\u3040-\u309F\u30A0-\u30FF\u30FC]+$/;

export function validateDictionaryEntry(word: string, reading: string): ValidationResult {
  const trimmedWord = word.trim();
  const trimmedReading = reading.trim();

  if (trimmedWord.length === 0) {
    return { valid: false, error: '単語を入力してください' };
  }
  if (trimmedWord.length > LIMITS.DICTIONARY_WORD_MAX_LENGTH) {
    return { valid: false, error: `単語は${LIMITS.DICTIONARY_WORD_MAX_LENGTH}文字以内で入力してください` };
  }

  if (trimmedReading.length === 0) {
    return { valid: false, error: '読みを入力してください' };
  }
  if (trimmedReading.length > LIMITS.DICTIONARY_READING_MAX_LENGTH) {
    return { valid: false, error: `読みは${LIMITS.DICTIONARY_READING_MAX_LENGTH}文字以内で入力してください` };
  }
  if (!KANA_ONLY_PATTERN.test(trimmedReading)) {
    return { valid: false, error: '読みはひらがな・カタカナのみ入力してください' };
  }

  return { valid: true };
}
