import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [
    react(),
  ],
  test: {
    name: 'use-case-builder',
    root: './tests',
    include: ['**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['./setupTests.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
    },
  },
});
