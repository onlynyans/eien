import { defineConfig } from 'vitest/config';

// Unit and architecture tests. End-to-end tests are Playwright's (tests/e2e).
// Two projects: the window's modules (src/ui) run in a DOM, happy-dom's; the
// rest in Node, as core must use neither and platform and app are Node's.
const WINDOW = 'src/ui/**/*.test.ts';

export default defineConfig({
  test: {
    setupFiles: ['tests/property-setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts', 'tests/*.test.ts'],
          exclude: [WINDOW],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: { name: 'window', include: [WINDOW], environment: 'happy-dom' },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text'],
      // What the tests covered (October 2026, on a Mac: 78.2, 75.5, 73.7, 79.9 with core/epub), less a
      // margin for Linux, where CI measures it and the Mac's own storage tests skip. Raise them as it grows.
      thresholds: { statements: 66, branches: 67, functions: 59, lines: 67 },
    },
  },
});
