import { defineConfig } from 'vitest/config';

/**
 * Unit tests that run without a database: crypto, date helpers and Zod
 * validation schemas. Integration tests that need MySQL are documented as a
 * guided manual plan in docs/ (they require a live DB + seed).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
