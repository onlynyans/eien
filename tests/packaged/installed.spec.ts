// The packaged app, as a writer installs it: it starts, shows Eien, opens a
// vault and saves into it, and keeps the window's storage from another build.
// npm run package first, or point EIEN_APP at an installed copy's executable
// (the release workflow does: the app in the .dmg, the one the setup installed).

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, type ElectronApplication, test } from '@playwright/test';
import { appEnv, closeApp, editorContent, expect, launchApp, makeVault, ROOT } from '../e2e/launch';

/** Where npm run package leaves this system's app, unpacked. */
const BUILT: Partial<Record<NodeJS.Platform, string>> = {
  darwin: 'dist/mac-universal/Eien.app/Contents/MacOS/Eien',
  win32: 'dist/win-unpacked/Eien.exe',
  linux: 'dist/linux-unpacked/eien',
};

const executable = resolve(ROOT, process.env.EIEN_APP ?? BUILT[process.platform] ?? '');

const launchPackaged = (userData: string, vault?: string): Promise<ElectronApplication> =>
  _electron.launch({ executablePath: executable, env: appEnv(userData, vault) });

/** A throwaway data folder, as each launch gets. */
const freshUserData = () => mkdtempSync(join(tmpdir(), 'eien-packaged-'));
const WINDOWS_LETS_GO = { recursive: true, force: true, maxRetries: 10, retryDelay: 200 };

test('starts as Eien, packaged, on the welcome screen', async () => {
  const userData = freshUserData();
  const app = await launchPackaged(userData);
  try {
    const page = await app.firstWindow();
    await expect(page).toHaveTitle('Eien');
    await expect(page.locator('.welcome__name')).toHaveText('Eien');
    // app.name names the settings folder (userData) of every installed copy.
    expect(await app.evaluate(({ app }) => ({ name: app.name, packaged: app.isPackaged }))).toEqual(
      { name: 'Eien', packaged: true },
    );
  } finally {
    await closeApp(app);
    rmSync(userData, WINDOWS_LETS_GO);
  }
});

test('opens a vault, and saves what is typed', async () => {
  const userData = freshUserData();
  const vault = makeVault({ 'Chapter One.md': 'It begins.\n' });
  const app = await launchPackaged(userData, vault);
  try {
    const page = await app.firstWindow();
    await page.locator('.note-row', { hasText: 'Chapter One' }).click();
    await editorContent(page).click();
    await page.keyboard.type('Again. ');
    await expect
      .poll(() => readFileSync(join(vault, 'Chapter One.md'), 'utf8'))
      .toContain('Again. ');
  } finally {
    await closeApp(app);
    rmSync(userData, WINDOWS_LETS_GO);
    rmSync(vault, WINDOWS_LETS_GO);
  }
});

test('keeps the window’s storage from a build at another path', async () => {
  // Pane widths, sorts and today's counters live in the window's storage,
  // inside userData. A new build is a page at another path: it must see them.
  const userData = freshUserData();
  const developed = await launchApp(userData);
  try {
    const page = await developed.firstWindow();
    await page.evaluate(() => localStorage.setItem('eien.packaged-test', 'kept'));
  } finally {
    await closeApp(developed);
  }
  const installed = await launchPackaged(userData);
  try {
    const page = await installed.firstWindow();
    expect(await page.evaluate(() => localStorage.getItem('eien.packaged-test'))).toBe('kept');
  } finally {
    await closeApp(installed);
    rmSync(userData, WINDOWS_LETS_GO);
  }
});
