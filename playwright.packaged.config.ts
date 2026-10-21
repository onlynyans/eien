import { defineConfig } from '@playwright/test';

// The packaged app (npm run package first, or EIEN_APP=<an installed copy's
// executable>): tests/packaged. The release workflow runs it on each system.
export default defineConfig({
  testDir: 'tests/packaged',
  timeout: 60_000,
  // One app at a time: a packaged app's first start is the slow one.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
});
