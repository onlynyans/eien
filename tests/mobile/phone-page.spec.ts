// The phone's page in a browser (playwright.mobile.config.ts): the vault in
// Eien's folder, kept by Capacitor's Filesystem; this device's settings in
// Preferences; what a crash left recovered; exports beside the vault. Files
// "from outside" are put there through the Filesystem itself, as Syncthing
// would put them on the phone.

import { expect, type Page, test } from '@playwright/test';

/** The Filesystem plugin's calls these tests make, as the page registered it. */
interface FilesystemCalls {
  writeFile(options: object): Promise<unknown>;
  readFile(options: object): Promise<{ data: string }>;
  readdir(options: object): Promise<{ files: { name: string }[] }>;
}

declare global {
  interface Window {
    Capacitor: { Plugins: { Filesystem: FilesystemCalls } };
  }
}

const DOCUMENTS = 'DOCUMENTS';

/** Write a file in Documents as another app would (Syncthing bringing a note from another device). */
const putOutside = (page: Page, path: string, text: string) =>
  page.evaluate(
    ([path, data, directory]) =>
      window.Capacitor.Plugins.Filesystem.writeFile({
        path,
        data,
        directory,
        encoding: 'utf8',
        recursive: true,
      }),
    [path, text, DOCUMENTS] as const,
  );

/** A file's text in Documents, or null. */
const readOutside = (page: Page, path: string) =>
  page.evaluate(
    ([path, directory]) =>
      window.Capacitor.Plugins.Filesystem.readFile({ path, directory, encoding: 'utf8' }).then(
        (file) => file.data,
        () => null,
      ),
    [path, DOCUMENTS] as const,
  );

/** The names in a folder in Documents. */
const listOutside = (page: Page, path: string) =>
  page.evaluate(
    ([path, directory]) =>
      window.Capacitor.Plugins.Filesystem.readdir({ path, directory }).then(
        (listing) => listing.files.map((file) => file.name).sort(),
        () => [],
      ),
    [path, DOCUMENTS] as const,
  );

const titles = (page: Page) => page.locator('.note-row__title');

async function open(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('.shell')).toBeVisible();
}

test.use({ viewport: { width: 1100, height: 800 } });

test('the vault opens at once: on the phone there is no folder to choose', async ({ page }) => {
  await open(page);
  await expect(page.locator('.welcome')).toHaveCount(0);
  expect(await page.evaluate(() => window.eien.platform)).toBe('web');
  expect(await page.evaluate(() => window.eien.vault.current())).toEqual({ name: 'Eien' });
});

test('a new note is written into Documents/Eien, and is there after a restart', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.locator('.cm-content')).toBeFocused();
  await page.keyboard.type('A first line, on the phone.');
  await expect
    .poll(() => readOutside(page, 'Eien/Untitled.md'), { timeout: 5000 })
    .toBe('A first line, on the phone.');
  await page.reload();
  await expect(titles(page)).toHaveText(['Untitled']);
});

test('a note another device synced in shows up without a restart', async ({ page }) => {
  await open(page);
  await putOutside(page, 'Eien/Tear.md', 'The scarf caught on the gate.\n');
  await expect(titles(page)).toHaveText(['Tear'], { timeout: 10_000 });
});

test('going to the background saves what was typed', async ({ page }) => {
  // Android may end an app in the background: the window saves on "pause", not 800 ms later.
  await page.clock.install();
  await open(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.locator('.cm-content')).toBeFocused();
  await page.keyboard.type('Saved on the way out.');
  // The page's clock stops here, so the usual save after typing never comes: only "pause" saves.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  expect(await readOutside(page, 'Eien/Untitled.md')).toBe(''); // made empty, not yet saved
  await page.evaluate(() => {
    // As the phone's going to the background shows in a page: hidden, then the event.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => readOutside(page, 'Eien/Untitled.md')).toBe('Saved on the way out.');
});

test('words a crash left in a temp file are kept as a recovered note', async ({ page }) => {
  await open(page);
  await putOutside(page, 'Eien/Fic/.Mend.md.eien.tmp', 'Mended, but never renamed.');
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
  const files = await listOutside(page, 'Eien/Fic');
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^Mend \(recovered \d{4}-\d\d-\d\d \d\d-\d\d\)\.md$/);
  expect(await readOutside(page, `Eien/Fic/${files[0]}`)).toBe('Mended, but never renamed.');
});

test('this device’s settings stay in Preferences; the vault’s go in its folder', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.scheme', 'night');
    await window.eien.settings.set('typography.quotes', 'straight');
  });
  expect(await readOutside(page, 'Eien/.eien/config.json')).toContain('"straight"');
  expect(await readOutside(page, 'Eien/.eien/config.json')).not.toContain('night');
  await page.reload();
  // Read at once, as the window does before it asks for the vault: the vault's settings are there.
  const values = await page.evaluate(() => window.eien.settings.read());
  expect([values['appearance.scheme'], values['typography.quotes']]).toEqual(['night', 'straight']);
});

test('trash goes to .eien/trash in the vault, from where any device can take it back', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, 'Eien/Tear.md', 'Words to keep.');
  await page.evaluate(() => window.eien.vault.trash('Tear.md'));
  const stamps = await listOutside(page, 'Eien/.eien/trash');
  expect(stamps).toHaveLength(1);
  expect(await readOutside(page, `Eien/.eien/trash/${stamps[0]}/Tear.md`)).toBe('Words to keep.');
  expect(await listOutside(page, 'Eien')).toEqual(['.eien']);
});

test('a rename that changes only case', async ({ page }) => {
  await open(page);
  await putOutside(page, 'Eien/tear.md', 'Words.');
  expect(await page.evaluate(() => window.eien.vault.move('tear.md', 'Tear.md'))).toEqual({
    ok: true,
  });
  expect(await listOutside(page, 'Eien')).toEqual(['Tear.md']);
  expect(await readOutside(page, 'Eien/Tear.md')).toBe('Words.');
});

test('the window cannot reach outside its vault', async ({ page }) => {
  await open(page);
  await putOutside(page, 'Secret.md', 'Not the vault’s.');
  const outcomes = await page.evaluate(async () => {
    const tries = ['../Secret.md', '/DOCUMENTS/Secret.md', 'Fic/../../Secret.md', '..'];
    return Promise.all(
      tries.map((path) =>
        window.eien.vault.read(path).then(
          () => 'read',
          () => 'refused',
        ),
      ),
    );
  });
  expect(outcomes).toEqual(['refused', 'refused', 'refused', 'refused']);
});

test('an export goes to Eien Exports, never over another', async ({ page }) => {
  await open(page);
  const saved = await page.evaluate(async () => [
    await window.eien.out.saveAs('Tear', '<p>One.</p>'),
    await window.eien.out.saveAs('Tear.html', '<p>Two.</p>'),
  ]);
  expect(saved).toEqual(['Eien Exports/Tear.html', 'Eien Exports/Tear 2.html']);
  expect(await readOutside(page, 'Eien Exports/Tear.html')).toBe('﻿<p>One.</p>');
});

test('Copy for AO3 puts the HTML on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await page.evaluate(() => window.eien.out.copy('<p>“Hi.”</p>', '<p>“Hi.”</p>'));
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('<p>“Hi.”</p>');
});
