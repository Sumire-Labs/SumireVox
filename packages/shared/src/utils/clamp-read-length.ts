import { LIMITS } from '../constants/limits.js';

export function clampReadLength(value: number, isPremium: boolean): number {
  const max = isPremium ? LIMITS.PREMIUM_MAX_READ_LENGTH : LIMITS.FREE_MAX_READ_LENGTH;
  return Math.min(value, max);
}
