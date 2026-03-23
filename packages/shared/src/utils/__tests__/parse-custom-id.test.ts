import { describe, it, expect } from 'vitest';
import { buildCustomId, parseCustomId, isCustomIdExpired } from '../parse-custom-id.js';

describe('buildCustomId / parseCustomId', () => {
  it('buildCustomId で生成した ID を正しくパースする', () => {
    const customId = buildCustomId('voice', 'speaker', '123456789');
    const parsed = parseCustomId(customId);
    expect(parsed).not.toBeNull();
    expect(parsed!.command).toBe('voice');
    expect(parsed!.action).toBe('speaker');
    expect(parsed!.userId).toBe('123456789');
    expect(parsed!.timestamp).toBeTypeOf('number');
  });

  it('action にコロンを含む場合でも正しくパースする', () => {
    const customId = buildCustomId('voice', 'speaker:3', '123456789');
    const parsed = parseCustomId(customId);
    expect(parsed).not.toBeNull();
    expect(parsed!.command).toBe('voice');
    expect(parsed!.action).toBe('speaker:3');
    expect(parsed!.userId).toBe('123456789');
  });

  it('action に複数のコロンを含む場合も正しくパースする', () => {
    const customId = buildCustomId('settings', 'page:2:filter', '987654321');
    const parsed = parseCustomId(customId);
    expect(parsed).not.toBeNull();
    expect(parsed!.action).toBe('page:2:filter');
    expect(parsed!.userId).toBe('987654321');
  });

  it('コロン区切りが4部分未満の不正な ID は null を返す', () => {
    expect(parseCustomId('invalid')).toBeNull();
    expect(parseCustomId('a:b:c')).toBeNull();
  });

  it('timestamp が NaN の場合は null を返す', () => {
    expect(parseCustomId('voice:action:123:notanumber')).toBeNull();
  });
});

describe('isCustomIdExpired', () => {
  it('現在時刻のタイムスタンプは期限切れでない', () => {
    const customId = buildCustomId('voice', 'action', '123456789');
    const parsed = parseCustomId(customId);
    expect(parsed).not.toBeNull();
    expect(isCustomIdExpired(parsed!)).toBe(false);
  });

  it('15分以上前のタイムスタンプは期限切れ', () => {
    const oldTimestamp = Math.floor(Date.now() / 1000) - 16 * 60; // 16分前
    const customId = `voice:action:123456789:${oldTimestamp}`;
    const parsed = parseCustomId(customId);
    expect(parsed).not.toBeNull();
    expect(isCustomIdExpired(parsed!)).toBe(true);
  });

  it('14分前のタイムスタンプは期限切れでない', () => {
    const recentTimestamp = Math.floor(Date.now() / 1000) - 14 * 60; // 14分前
    const customId = `voice:action:123456789:${recentTimestamp}`;
    const parsed = parseCustomId(customId);
    expect(parsed).not.toBeNull();
    expect(isCustomIdExpired(parsed!)).toBe(false);
  });
});
