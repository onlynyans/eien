// A portable copy, as a writer carries it: its notes in Vault and everything
// else it keeps (this device's settings, the window's own storage) in
// "Eien Data", both beside it.
// npm run package first, or EIEN_PORTABLE_APP=<its executable>.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { _electron, test } from '@playwright/test';
import { closeApp, expect } from '../e2e/launch';
import { ownFoldersEnv, portableApp } from './packaged';

const WINDOWS_LETS_GO = { recursive: true, force: true, maxRetries: 10, retryDelay: 200 };

test('keeps its notes in Vault and everything else in “Eien Data”, beside itself', async () => {
  test.skip(!portableApp, 'Linux has no portable build: the AppImage is one already');
  const executable = portableApp ?? '';
  // Windows runs the portable .exe from a temp copy, and its launcher names the
  // folder it came from. Here the copy is unpacked, so the test names one.
  const windows = process.platform === 'win32';
  const home = windows
    ? mkdtempSync(join(tmpdir(), 'eien-carried-'))
    : resolve(executable, '../../../..');
  const data = join(home, 'Eien Data');
  const vault = join(home, 'Vault');
  rmSync(data, WINDOWS_LETS_GO);
  rmSync(vault, WINDOWS_LETS_GO);
  mkdirSync(vault);
  writeFileSync(join(vault, 'Chapter One.md'), 'It begins.\n');
  const env = ownFoldersEnv();
  if (windows) env.PORTABLE_EXECUTABLE_DIR = home;
  const app = await _electron.launch({ executablePath: executable, env });
  try {
    const page = await app.firstWindow();
    await expect(page.locator('.note-row', { hasText: 'Chapter One' })).toBeVisible();
    await page.evaluate(() => window.eien.settings.set('appearance.scheme', 'night'));
    const settings = join(data, 'settings.json');
    await expect.poll(() => existsSync(settings)).toBe(true);
    expect(JSON.parse(readFileSync(settings, 'utf8')).settings).toMatchObject({
      'appearance.scheme': 'night',
    });
    // Chromium's own storage too: the window's, and the rest of Electron's data folder.
    const userData = await app.evaluate(({ app }) => app.getPath('userData'));
    expect(userData.toLowerCase()).toBe(data.toLowerCase());
  } finally {
    await closeApp(app);
    rmSync(data, WINDOWS_LETS_GO);
    rmSync(vault, WINDOWS_LETS_GO);
    if (windows) rmSync(home, WINDOWS_LETS_GO);
  }
});
