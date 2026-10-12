import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      // Only the layers that must be testable without React Native.
      include: ['src/domeinen/**/{domain,service,api}/**/*.ts', 'src/shared/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/index.ts',
        'src/shared/platform/rn/**',
        'src/shared/ui/**',
        'src/shared/**/types.ts',
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
});
