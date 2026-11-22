import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wyw from '@wyw-in-js/vite';

export default defineConfig({
  cacheDir: '.vite-cache',
  base: './',
  plugins: [{ ...wyw({ include: ['src/**/*.{ts,tsx}'] }), enforce: 'pre' }, react()],
});
