import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути: архив для Яндекс Игр работает из любой папки.
  base: './',
  resolve: {
    alias: { '@engine': fileURLToPath(new URL('../../engine', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    // Звуки и спрайты — отдельными файлами, а не внутри JS.
    assetsInlineLimit: 0,
    // Three.js сам по себе весит ~600 КБ (~150 КБ в gzip) — это нормально.
    chunkSizeWarningLimit: 1000,
  },
});
