import { describe, it, expect } from 'vitest';
import { clampReadLength } from '../clamp-read-length.js';
import { LIMITS } from '../../constants/limits.js';

describe('clampReadLength', () => {
  it('PREMIUM の上限は FREE より大きい', () => {
    expect(LIMITS.PREMIUM_MAX_READ_LENGTH).toBeGreaterThan(LIMITS.FREE_MAX_READ_LENGTH);
  });

  it('FREE: 上限以内の値はそのまま返す', () => {
    expect(clampReadLength(30, false)).toBe(30);
  });

  it('FREE: 上限値ちょうどはそのまま返す', () => {
    expect(clampReadLength(LIMITS.FREE_MAX_READ_LENGTH, false)).toBe(LIMITS.FREE_MAX_READ_LENGTH);
  });

  it('FREE: 上限を超える値は上限値に切り詰める', () => {
    const result = clampReadLength(LIMITS.FREE_MAX_READ_LENGTH + 50, false);
    expect(result).toBe(LIMITS.FREE_MAX_READ_LENGTH);
  });

  it('PREMIUM: 上限以内の値はそのまま返す', () => {
    expect(clampReadLength(100, true)).toBe(100);
  });

  it('PREMIUM: 上限値ちょうどはそのまま返す', () => {
    expect(clampReadLength(LIMITS.PREMIUM_MAX_READ_LENGTH, true)).toBe(LIMITS.PREMIUM_MAX_READ_LENGTH);
  });

  it('PREMIUM: 上限を超える値は PREMIUM 上限値に切り詰める', () => {
    const result = clampReadLength(LIMITS.PREMIUM_MAX_READ_LENGTH + 100, true);
    expect(result).toBe(LIMITS.PREMIUM_MAX_READ_LENGTH);
  });

  it('FREE でも PREMIUM でも 0 は 0 を返す', () => {
    expect(clampReadLength(0, false)).toBe(0);
    expect(clampReadLength(0, true)).toBe(0);
  });

  it('FREE の上限は PREMIUM の上限より小さい値を切り詰めない', () => {
    const withinFree = LIMITS.FREE_MAX_READ_LENGTH - 1;
    expect(clampReadLength(withinFree, true)).toBe(withinFree);
  });
});
