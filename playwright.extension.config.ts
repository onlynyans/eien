import { defineConfig } from '@playwright/test';

// The extension (npm run build:extension first) in Chromium, loaded as
// a writer loads it unpacked. The story sites are the test's own pages
// (tests/support/story-pages), served for their addresses, so nothing is
// fetched from the web.
export default defineConfig({
  testDir: 'tests/extension',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
});
