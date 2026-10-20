import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, test as base, type ElectronApplication, type Page } from '@playwright/test';

export const ROOT = resolve(import.meta.dirname, '../..');

/** Environment for a launch with its own, throwaway data folder. */
export function appEnv(userData: string): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  // A dev-server URL left in the shell would make the app load that instead of the build.
  delete env.ELECTRON_RENDERER_URL;
  return { ...env, EIEN_USER_DATA: userData };
}

type Fixtures = { userData: string; app: ElectronApplication; page: Page };

/** Each test gets a fresh app with a fresh data folder, closed afterwards. */
export const test = base.extend<Fixtures>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright's fixture signature
  userData: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'eien-e2e-'));
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
  app: async ({ userData }, use) => {
    const app = await _electron.launch({ args: [ROOT], cwd: ROOT, env: appEnv(userData) });
    await use(app);
    await app.close();
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect } from '@playwright/test';
