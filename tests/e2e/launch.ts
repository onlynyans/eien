import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, test as base, type ElectronApplication, type Page } from '@playwright/test';

export const ROOT = resolve(import.meta.dirname, '../..');

/**
 * Environment for a launch with its own, throwaway data folder, and the
 * vault at `vault` (or, without one, the welcome screen).
 */
export function appEnv(userData: string, vault?: string | null): Record<string, string> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  // A dev-server URL left in the shell would make the app load that instead of the build.
  delete env.ELECTRON_RENDERER_URL;
  delete env.EIEN_VAULT;
  return { ...env, EIEN_USER_DATA: userData, ...(vault ? { EIEN_VAULT: vault } : {}) };
}

/** What a test vault holds: vault path → text, or bytes for an image. */
export type VaultFiles = Record<string, string | Uint8Array>;

/** A throwaway vault holding `files`. */
export function makeVault(files: VaultFiles): string {
  const root = mkdtempSync(join(tmpdir(), 'eien-vault-'));
  for (const [path, text] of Object.entries(files)) {
    const file = join(root, ...path.split('/'));
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, text);
  }
  return root;
}

/** Apps closeApp has closed: Playwright can't be asked about them again. */
const closed = new WeakSet<ElectronApplication>();

/** How long a normal quit may take before the test kills the app. */
const QUIT_LIMIT_MS = 10_000;

/**
 * Quit the app, and if it hasn't exited in QUIT_LIMIT_MS, kill it and say so.
 * On slow CI machines Electron's quit has, once, hung past the test's own
 * timeout; this keeps one slow exit from failing the run, and leaves a
 * warning in the log so a real hang can't hide.
 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  // A test may close the app itself; the fixture's close afterwards is then a no-op.
  if (closed.has(app)) return;
  closed.add(app);
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

type Fixtures = {
  /** Files for the test's vault; null (the default) opens no vault. */
  vaultFiles: VaultFiles | null;
  /** The vault folder, when there is one. */
  vault: string | null;
  userData: string;
  app: ElectronApplication;
  page: Page;
};

/** Each test gets a fresh app with a fresh data folder, closed afterwards. */
export const test = base.extend<Fixtures>({
  vaultFiles: [null, { option: true }],
  vault: async ({ vaultFiles }, use) => {
    if (!vaultFiles) return use(null);
    const root = makeVault(vaultFiles);
    await use(root);
    rmSync(root, { recursive: true, force: true });
  },
  // biome-ignore lint/correctness/noEmptyPattern: Playwright's fixture signature
  userData: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'eien-e2e-'));
    await use(dir);
    rmSync(dir, { recursive: true, force: true });
  },
  app: async ({ userData, vault }, use) => {
    const app = await _electron.launch({ args: [ROOT], cwd: ROOT, env: appEnv(userData, vault) });
    await use(app);
    await closeApp(app);
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

/** The note editor's lines, as they show (Live hides the marks away from the caret). */
export const editorLines = (page: Page) => page.locator('.cm-line');

/** Where the writer types: CodeMirror's content, inside the editor's shadow root. */
export const editorContent = (page: Page) => page.locator('.cm-content');

export { expect } from '@playwright/test';
