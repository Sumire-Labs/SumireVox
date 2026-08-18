import { beforeEach, describe, expect, it, vi } from 'vitest';

const { configMock } = vi.hoisted(() => ({
  configMock: {
    corsOrigin: ['http://localhost:5173'],
  },
}));

vi.mock('./infrastructure/config.js', () => ({
  config: configMock,
}));

import { createApp } from './app.js';

/**
 * F-01 の修正後契約テスト。
 * 未知パス・未対応メソッドは JSON エンベロープの NOT_FOUND 404 を返す。
 */
describe('createApp 404 contract (F-01)', () => {
  beforeEach(() => {
    configMock.corsOrigin = ['http://localhost:5173'];
  });

  it('unknown path returns NOT_FOUND JSON envelope', async () => {
    const app = createApp();
    const res = await app.request('/api/nonexistent');

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'リソースが見つかりません。' },
    });
  });

  it('wrong method on /health returns NOT_FOUND JSON envelope', async () => {
    const app = createApp();
    const res = await app.request('/health', { method: 'POST' });

    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'リソースが見つかりません。' },
    });
  });
});
