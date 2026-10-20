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

/** How long a normal quit may take before the test kills the app. */
const QUIT_LIMIT_MS = 10_000;

/**
 * Quit the app, and if it hasn't exited in QUIT_LIMIT_MS, kill it and say so.
 * On slow CI machines Electron's quit has, once, hung past the test's own
 * timeout; this keeps one slow exit from failing the run, and leaves a
 * warning in the log so a real hang can't hide.
 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  const child = app.process();
  const exited = new Promise<void>((done) => {
    if (child.exitCode !== null || child.signalCode !== null) done();
    else child.once('exit', () => done());
  });
  const late = Symbol('late');
  const outcome = await Promise.race([
    app.close().then(
      () => exited,
      () => exited,
    ),
    new Promise<symbol>((done) => setTimeout(() => done(late), QUIT_LIMIT_MS)),
  ]);
  if (outcome === late) {
    console.warn(`Eien did not quit within ${QUIT_LIMIT_MS} ms; killing it.`);
    child.kill('SIGKILL');
    await exited;
  }
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
    await closeApp(app);
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

export { expect } from '@playwright/test';
