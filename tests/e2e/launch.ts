import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  _electron,
  test as base,
  type ElectronApplication,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

export const ROOT = resolve(import.meta.dirname, '../..');

/**
 * A test that runs alone, one at a time, after the others (npm run test:e2e,
 * and CI): one that holds the app to a time (a draw, a search, a save,
 * typing without a stall), which other apps on the machine would slow; or
 * one that drags with the pointer, which another test's window opening
 * takes the focus from, cancelling the drag as it should.
 */
export const ALONE = { tag: '@alone' };

/**
 * Environment for a launch with its own, throwaway data folder, and the
 * vault at `vault` (or, without one, its own: Vault, inside `userData`).
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

/** Launch the built app with its data in `userData`, and the vault at `vault` if given. */
export const launchApp = (userData: string, vault?: string | null): Promise<ElectronApplication> =>
  _electron.launch({ args: [ROOT], cwd: ROOT, env: appEnv(userData, vault) });

/** Where a locator's element is on screen. */
export type Box = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;

/** A locator's box, measured again if a redraw (the watcher's, after a save) replaced it. */
export async function boxOf(locator: Locator): Promise<Box> {
  let found: Box | null = null;
  await expect
    .poll(async () => {
      found = await locator.boundingBox();
      return found !== null;
    })
    .toBe(true);
  return found as unknown as Box;
}

/**
 * Click a menu item, as the window the click is for: no reliance on which
 * window has focus. `labels` go down through submenus (File → Export Note → EPUB…).
 */
export const clickMenu = (app: ElectronApplication, menu: string, ...labels: string[]) =>
  clickMenuIn(app, 0, menu, ...labels);

/** Click a menu item for the `nth` window opened (0 is the first), as clickMenu does. */
export async function clickMenuIn(
  app: ElectronApplication,
  nth: number,
  menu: string,
  ...labels: string[]
): Promise<void> {
  await app.evaluate(
    ({ BrowserWindow, Menu }, [nth, path]) => {
      const windows = BrowserWindow.getAllWindows().sort((a, b) => a.id - b.id);
      const window = windows[nth];
      let items = Menu.getApplicationMenu()?.items;
      let item: Electron.MenuItem | undefined;
      for (const label of path) {
        item = items?.find((entry) => entry.label === label);
        items = item?.submenu?.items;
      }
      if (!item || !window) throw new Error(`No menu item ${path.join(' → ')} for window ${nth}`);
      item.click(undefined, window, window.webContents);
    },
    [nth, [menu, ...labels]] as const,
  );
}

/** File → New Window in the `nth` window opened: the new window's page, loaded. */
export async function newWindow(app: ElectronApplication, nth = 0): Promise<Page> {
  const [page] = await Promise.all([
    app.waitForEvent('window'),
    clickMenuIn(app, nth, 'File', 'New Window'),
  ]);
  await page.waitForLoadState('domcontentloaded');
  return page;
}

/**
 * A file's text, or '' while it can't be read: for expect.poll, which a
 * throwing read would end at once instead of trying again while a write lands.
 */
export function readQuietly(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/**
 * The system's trash, played by a folder: what the app sends there is moved
 * into it, after `delayMs` (a big folder, a network drive); or, when it
 * doesn't `work`, refused. The caller removes the folder.
 */
export async function fakeTrash(
  app: ElectronApplication,
  { works = true, delayMs = 0 } = {},
): Promise<string> {
  const trash = mkdtempSync(join(tmpdir(), 'eien-trash-'));
  await app.evaluate(
    ({ shell }, [trash, works, delayMs]) => {
      shell.trashItem = async (path: string) => {
        await new Promise((done) => setTimeout(done, delayMs));
        if (!works) throw new Error('The trash is full.');
        const fs = process.getBuiltinModule('node:fs');
        const { basename, join } = process.getBuiltinModule('node:path');
        fs.renameSync(path, join(trash, basename(path)));
      };
    },
    [trash, works, delayMs] as const,
  );
  return trash;
}

/** Apps closeApp has closed: Playwright can't be asked about them again. */
const closed = new WeakSet<ElectronApplication>();

/** How long a normal quit may take before the test kills the app. */
const QUIT_LIMIT_MS = 10_000;

/**
 * End the app and every process it started. On Windows, killing Electron's
 * main process leaves its GPU, renderer and crash-report processes running,
 * holding the data folder (its removal fails, EPERM) and slowing the tests
 * after it until they hang too; taskkill /T ends the whole tree.
 */
function killApp(child: ReturnType<ElectronApplication['process']>): void {
  if (process.platform === 'win32' && child.pid !== undefined) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f']);
  }
  child.kill('SIGKILL'); // where taskkill couldn't, or anywhere else
}

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
    killApp(child);
    await exited;
  }
}

type Fixtures = {
  /** Files for the test's vault; null (the default) opens no vault. */
  vaultFiles: VaultFiles | null;
  /** The vault folder, when there is one. */
  vault: string | null;
  /** This device's settings file, as the app keeps it; null (the default) for none. */
  deviceFile: Record<string, unknown> | null;
  userData: string;
  app: ElectronApplication;
  page: Page;
};

/** Windows holds a closed app's files a moment longer: removing them tries again (EBUSY, EPERM). */
const WINDOWS_LETS_GO = { maxRetries: 10, retryDelay: 200 };

/** Each test gets a fresh app with a fresh data folder, closed afterwards. */
export const test = base.extend<Fixtures>({
  vaultFiles: [null, { option: true }],
  deviceFile: [null, { option: true }],
  vault: async ({ vaultFiles }, use) => {
    if (!vaultFiles) return use(null);
    const root = makeVault(vaultFiles);
    await use(root);
    rmSync(root, { recursive: true, force: true, ...WINDOWS_LETS_GO });
  },
  userData: async ({ deviceFile }, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'eien-e2e-'));
    if (deviceFile) writeFileSync(join(dir, 'settings.json'), JSON.stringify(deviceFile));
    await use(dir);
    rmSync(dir, { recursive: true, force: true, ...WINDOWS_LETS_GO });
  },
  app: async ({ userData, vault }, use) => {
    const app = await launchApp(userData, vault);
    await use(app);
    await closeApp(app);
  },
  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await use(page);
  },
});

/** The whole window's zoom factor (Electron's, every pane): 1 at 100%. */
export const windowZoom = (app: ElectronApplication): Promise<number> =>
  app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.webContents.getZoomFactor() ?? 0,
  );

/** Where the window controls overlay leaves the page free, in the page's pixels. */
export const freeArea = (page: Page) =>
  page.evaluate(() => {
    // The window controls overlay's API, which TypeScript's DOM types don't have yet.
    const overlay = (
      navigator as Navigator & {
        windowControlsOverlay: { visible: boolean; getTitlebarAreaRect(): DOMRect };
      }
    ).windowControlsOverlay;
    const { x, width } = overlay.getTitlebarAreaRect();
    return { visible: overlay.visible, left: x, right: innerWidth - x - width };
  });

/** The note editor's lines, as they show (Live hides the marks away from the caret). */
export const editorLines = (page: Page) => page.locator('.cm-line');

/** Where the writer types: CodeMirror's content, inside the editor's shadow root. */
export const editorContent = (page: Page) => page.locator('.cm-content');

export { expect } from '@playwright/test';
