import { defineConfig } from '@playwright/test';

// Eien on an Android phone or emulator, through adb (npm run test:android, which
// builds and installs the debug APK first). Not in CI: it needs a device. See
// tests/android/phone.ts for what it expects.
export default defineConfig({
  testDir: 'tests/android',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1, // one phone
  reporter: 'list',
  use: { trace: 'retain-on-failure' },
});
