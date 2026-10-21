// The phone's page in a browser (playwright.mobile.config.ts): the vault in
// Eien's folder, kept by Capacitor's Filesystem; this device's settings in
// Preferences; what a crash left recovered; exports beside the vault. Files
// "from outside" are put there through the Filesystem itself, as Syncthing
// would put them on the phone.

import { expect, test } from '@playwright/test';
import {
  bytesOutside,
  listOutside,
  open,
  putBytesOutside,
  putOutside,
  readOutside,
  titles,
} from './outside';

test.use({ viewport: { width: 1100, height: 800 } });

test('the vault opens at once: on the phone there is no folder to choose', async ({ page }) => {
  await open(page);
  await expect(page.locator('.welcome')).toHaveCount(0);
  expect(await page.evaluate(() => window.eien.platform)).toBe('web');
  // No Syncthing marker in the vault here: no sync status.
  expect(await page.evaluate(() => window.eien.vault.current())).toEqual({
    name: 'Eien',
    syncthing: false,
  });
});

test('a new note is written into Documents/Eien/Vault, and is there after a restart', async ({
  page,
}) => {
  await open(page);
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.locator('.cm-content')).toBeFocused();
  await page.keyboard.type('A first line, on the phone.');
  await expect
    .poll(() => readOutside(page, 'Eien/Vault/Untitled.md'), { timeout: 5000 })
    .toBe('A first line, on the phone.');
  await page.reload();
  await expect(titles(page)).toHaveText(['Untitled']);
});

test('a note another device synced in shows up without a restart', async ({ page }) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Tear.md', 'The scarf caught on the gate.\n');
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
  expect(await readOutside(page, 'Eien/Vault/Untitled.md')).toBe(''); // made empty, not yet saved
  await page.evaluate(() => {
    // As the phone's going to the background shows in a page: hidden, then the event.
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect
    .poll(() => readOutside(page, 'Eien/Vault/Untitled.md'))
    .toBe('Saved on the way out.');
});

test('words a crash left in a temp file are kept as a recovered note', async ({ page }) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Fic/.Mend.md.eien.tmp', 'Mended, but never renamed.');
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
  const files = await listOutside(page, 'Eien/Vault/Fic');
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^Mend \(recovered \d{4}-\d\d-\d\d \d\d-\d\d\)\.md$/);
  expect(await readOutside(page, `Eien/Vault/Fic/${files[0]}`)).toBe('Mended, but never renamed.');
});

test('this device’s settings stay in Preferences; the vault’s go in its folder', async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.scheme', 'night');
    await window.eien.settings.set('typography.quotes', 'straight');
  });
  expect(await readOutside(page, 'Eien/Vault/.eien/config.json')).toContain('"straight"');
  expect(await readOutside(page, 'Eien/Vault/.eien/config.json')).not.toContain('night');
  await page.reload();
  // Read at once, as the window does before it asks for the vault: the vault's settings are there.
  const values = await page.evaluate(() => window.eien.settings.read());
  expect([values['appearance.scheme'], values['typography.quotes']]).toEqual(['night', 'straight']);
});

test('trash goes to .eien/trash in the vault, from where any device can take it back', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Tear.md', 'Words to keep.');
  await page.evaluate(() => window.eien.vault.trash('Tear.md'));
  const stamps = await listOutside(page, 'Eien/Vault/.eien/trash');
  expect(stamps).toHaveLength(1);
  expect(await readOutside(page, `Eien/Vault/.eien/trash/${stamps[0]}/Tear.md`)).toBe(
    'Words to keep.',
  );
  expect(await listOutside(page, 'Eien/Vault')).toEqual(['.eien']);
});

test('a rename that changes only case', async ({ page }) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/tear.md', 'Words.');
  expect(await page.evaluate(() => window.eien.vault.move('tear.md', 'Tear.md'))).toEqual({
    ok: true,
  });
  expect(await listOutside(page, 'Eien/Vault')).toEqual(['Tear.md']);
  expect(await readOutside(page, 'Eien/Vault/Tear.md')).toBe('Words.');
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

test('an export goes to Eien/Exports, never over another', async ({ page }) => {
  await open(page);
  const saved = await page.evaluate(async () => [
    await window.eien.out.saveAs('Tear', { kind: 'html', text: '<p>One.</p>' }),
    await window.eien.out.saveAs('Tear.html', { kind: 'html', text: '<p>Two.</p>' }),
  ]);
  expect(saved).toEqual(['Eien/Exports/Tear.html', 'Eien/Exports/Tear 2.html']);
  expect(await readOutside(page, 'Eien/Exports/Tear.html')).toBe('﻿<p>One.</p>');
});

test('a note’s menu exports it as EPUB or Word into Eien/Exports; no PDF on the phone', async ({
  page,
}) => {
  await open(page);
  await putOutside(page, 'Eien/Vault/Tear.md', 'The scarf ==caught== on the gate.\n');
  await expect(titles(page)).toHaveText(['Tear'], { timeout: 10_000 });
  for (const label of ['EPUB…', 'Word (.docx)…']) {
    await page.locator('.note-row', { hasText: 'Tear' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Export…' }).click();
    await expect(page.getByRole('menuitem')).toHaveText(['AO3 HTML…', 'EPUB…', 'Word (.docx)…']);
    await page.getByRole('menuitem', { name: label }).click();
  }
  await expect(page.locator('.list__notice')).toHaveText('Saved as “Eien/Exports/Tear.docx”.');
  expect(await listOutside(page, 'Eien/Exports')).toEqual(['Tear.docx', 'Tear.epub']);
  // Zips: an EPUB's first file is its mimetype, stored.
  const epub = await bytesOutside(page, 'Eien/Exports/Tear.epub');
  expect(String.fromCharCode(...(epub ?? []).slice(0, 4))).toBe('PK\u0003\u0004');
  expect(String.fromCharCode(...(epub ?? []).slice(30, 58))).toBe('mimetypeapplication/epub+zip');
  const docx = await bytesOutside(page, 'Eien/Exports/Tear.docx');
  expect(String.fromCharCode(...(docx ?? []).slice(30, 49))).toBe('[Content_Types].xml');
});

test('the phone’s EPUB carries the note’s image from the vault', async ({ page }) => {
  await open(page);
  // A 1×1 GIF, as Syncthing would bring it.
  const gif = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
  await putBytesOutside(page, 'Eien/Vault/art/dot.gif', gif);
  await putOutside(page, 'Eien/Vault/Dot.md', 'A dot: ![dot](art/dot.gif)\n');
  await expect(titles(page)).toHaveText(['Dot'], { timeout: 10_000 });
  await page.locator('.note-row', { hasText: 'Dot' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Export…' }).click();
  await page.getByRole('menuitem', { name: 'EPUB…' }).click();
  await expect(page.locator('.list__notice')).toHaveText('Saved as “Eien/Exports/Dot.epub”.');
  const epub = String.fromCharCode(...((await bytesOutside(page, 'Eien/Exports/Dot.epub')) ?? []));
  expect(epub).toContain('OEBPS/images/image-1.gif');
  expect(epub).toContain('<img src="images/image-1.gif" alt="dot" />');
});

test('the phone makes no PDF and imports no folder, and says so', async ({ page }) => {
  await open(page);
  const outcomes = await page.evaluate(async () => ({
    kinds: window.eien.out.kinds,
    pdf: await window.eien.out
      .saveAs('Book', { kind: 'pdf', html: '<p>x</p>', page: 'a4' })
      .then(String, (error: Error) => error.message),
    imported: await window.eien.vault.importFolder().then(String, (error: Error) => error.message),
  }));
  expect(outcomes).toEqual({
    kinds: ['html', 'epub', 'docx'],
    pdf: 'A PDF isn’t made on the phone yet: export it on a computer.',
    imported:
      'Importing is on the computer: on the phone, copy the folder into Documents/Eien/Vault.',
  });
  expect(await listOutside(page, 'Eien/Exports')).toEqual([]);
});

test('Copy for AO3 puts the HTML on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  await page.evaluate(() => window.eien.out.copy('<p>“Hi.”</p>', '<p>“Hi.”</p>'));
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('<p>“Hi.”</p>');
});
