import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@engine': fileURLToPath(new URL('./engine', import.meta.url)) },
  },
  test: {
    include: ['engine/**/*.test.ts', 'games/*/src/**/*.test.ts'],
  },
});
