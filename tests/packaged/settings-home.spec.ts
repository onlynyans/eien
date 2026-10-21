// The installed app with this computer's own folders: this device's settings
// move from Electron's data folder to Documents/Eien, and the vault they name
// opens. It changes the real folders, so it runs only where asked
// (EIEN_REAL_FOLDERS=1: the release workflow's throwaway machines), never on
// a writer's computer. The rules' details are in src/app/electron's tests.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { _electron, test } from '@playwright/test';
import { closeApp, expect, makeVault } from '../e2e/launch';
import { installedApp, ownFoldersEnv } from './packaged';

/** The installed app as a writer starts it: no folder of its own, no vault named. */
const launchInstalled = () =>
  _electron.launch({ executablePath: installedApp, env: ownFoldersEnv() });

test('moves this device’s settings into Documents/Eien, and opens their vault', async () => {
  test.skip(process.env.EIEN_REAL_FOLDERS !== '1', 'changes this computer’s own folders');
  const first = await launchInstalled();
  const where = await first.evaluate(({ app }) => ({
    userData: app.getPath('userData'),
    documents: app.getPath('documents'),
  }));
  await closeApp(first);

  const old = join(where.userData, 'settings.json');
  const home = join(where.documents, 'Eien', 'settings.json');
  const vault = makeVault({ 'Chapter One.md': 'It begins.\n' });
  rmSync(home, { force: true });
  mkdirSync(where.userData, { recursive: true });
  writeFileSync(old, JSON.stringify({ vault, settings: { 'appearance.scheme': 'night' } }));

  const app = await launchInstalled();
  try {
    const page = await app.firstWindow();
    await expect(page.locator('.note-row', { hasText: 'Chapter One' })).toBeVisible();
    expect(JSON.parse(readFileSync(home, 'utf8'))).toMatchObject({ vault });
    expect(existsSync(old)).toBe(false);
  } finally {
    await closeApp(app);
    rmSync(vault, { recursive: true, force: true });
  }
});
