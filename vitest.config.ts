import { defineConfig } from 'vitest/config';

// Unit and architecture tests. End-to-end tests are Playwright's (tests/e2e).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/property-setup.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.ts'], reporter: ['text'] },
  },
});
