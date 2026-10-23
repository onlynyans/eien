import { defineConfig } from '@playwright/test';

// End-to-end tests drive the built app (npm run build first; npm run test:e2e does).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Half the cores is Playwright's own choice: two on Linux's and Windows' runners, but one on
  // macOS's three, whose run outgrew the job's 20 minutes. Two everywhere; the tests held to
  // a time or a drag run alone all the same (--workers=1, ci.yml).
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
});
