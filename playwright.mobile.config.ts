import { defineConfig } from '@playwright/test';

// The phone's page (npm run build:mobile first) in a browser. Capacitor's own
// web versions stand in for the phone's plugins — the Filesystem in IndexedDB,
// Preferences in localStorage — so the phone's bridge, its storage over the
// Filesystem's calls, its recovery and the window run as on the phone.
// Another port for a second checkout's run at the same time (a worktree's).
const PORT = Number(process.env.EIEN_MOBILE_PORT ?? 4174);

export default defineConfig({
  testDir: 'tests/mobile',
  timeout: 30_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npx vite preview --config vite.mobile.config.ts --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
});
