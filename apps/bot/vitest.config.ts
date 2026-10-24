import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    dir: 'src',
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@sumirevox/shared': resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
