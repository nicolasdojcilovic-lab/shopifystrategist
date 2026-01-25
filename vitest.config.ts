import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
        'src/app/**/*', // Exclure Next.js app router (UI)
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ssot': path.resolve(__dirname, './src/ssot'),
      '@contracts': path.resolve(__dirname, './src/contracts'),
      '@core': path.resolve(__dirname, './src/core'),
      '@adapters': path.resolve(__dirname, './src/adapters'),
      '@app': path.resolve(__dirname, './src/app'),
      '@devtools': path.resolve(__dirname, './src/devtools'),
      '@jobs': path.resolve(__dirname, './src/jobs'),
      '@lib': path.resolve(__dirname, './src/lib'),
    },
  },
});
