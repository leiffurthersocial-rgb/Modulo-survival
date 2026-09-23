/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1200,
  },
  test: {
    environment: 'node',
    // `npm run soak` runs the long balance simulations in tools/
    include: process.env.TOOLS ? ['tools/**/*.test.ts'] : ['tests/**/*.test.ts'],
    testTimeout: process.env.TOOLS ? 600_000 : 5_000,
  },
});
