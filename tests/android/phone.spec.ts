// Eien on Android (spec §10): the access asked for once, the vault in the
// shared Documents/Eien, what another device syncs in, saving when the app
// goes to the background, a restart, and a crash's leftovers recovered.

import type { AndroidDevice, Page } from '@playwright/test';
import {
  EXPORTS,
  expect,
  listOnPhone,
  PKG,
  putOnPhone,
  readOnPhone,
  shell,
  startEien,
  test,
  VAULT,
} from './phone';

const titles = (page: Page) => page.locator('.note-row__title');

/** The screen Android shows in front now, as `package/activity`. */
const resumed = async (device: AndroidDevice) =>
  (await shell(device, 'dumpsys activity activities')).match(
    /topResumedActivity=\S+ \S+ (\S+)/,
  )?.[1] ?? '';

/** A new note, with the keyboard in it. */
async function newNote(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'New note' }).click();
  await expect(page.locator('.cm-content')).toBeFocused();
}

test('Eien may not use the internet', async ({ device }) => {
  // Nothing leaves the phone but what Syncthing syncs (spec §1): not even the permission to.
  const granted = await shell(device, `dumpsys package ${PKG}`);
  expect(granted).not.toContain('android.permission.INTERNET');
  expect(granted).toContain('android.permission.MANAGE_EXTERNAL_STORAGE');
});

test('without the access, the welcome says why it’s needed; given, the vault opens', async ({
  device,
}) => {
  let page = await startEien(device, { allowed: false });
  await expect(page.locator('.welcome__lede')).toContainText('Documents/Eien');
  await expect(page.locator('.shell')).toHaveCount(0);
  // Given on Android's screen, the access starts Eien again, as this does.
  page = await startEien(device, { keep: true, allowed: true });
  await expect(page.locator('.shell')).toBeVisible();
  expect(await listOnPhone(device, VAULT)).toEqual([]);
});

test('Allow opens Android’s own screen; back without it, the welcome stays', async ({ device }) => {
  const page = await startEien(device, { allowed: false });
  await page.getByRole('button', { name: 'Allow file access…' }).click();
  await expect.poll(() => resumed(device)).toContain('com.android.settings');
  await shell(device, 'input keyevent KEYCODE_BACK');
  await expect.poll(() => resumed(device)).toContain(PKG);
  await expect(page.locator('.welcome__lede')).toBeVisible();
  await expect(page.locator('.shell')).toHaveCount(0);
});

test('typing writes the note in Documents/Eien', async ({ device }) => {
  const page = await startEien(device);
  await newNote(page);
  await page.keyboard.type('Written on the phone.');
  await expect
    .poll(() => readOnPhone(device, `${VAULT}/Untitled.md`))
    .toBe('Written on the phone.');
});

test('a note Syncthing brings in shows up without a restart', async ({ device }) => {
  const page = await startEien(device);
  await expect(page.locator('.shell')).toBeVisible();
  await putOnPhone(device, `${VAULT}/Fic/Tear.md`, 'The scarf caught on the gate.\n');
  await expect(titles(page)).toHaveText(['Tear']);
});

test('sent to the background, what was typed is saved at once', async ({ device }) => {
  // Android may end an app it has sent to the background: the save can't wait 800 ms.
  let page = await startEien(device);
  await page.clock.install();
  await page.reload();
  await expect(page.locator('.shell')).toBeVisible();
  await newNote(page);
  // The page's clock stops before the typing (slow, over adb): the save after typing never
  // comes, so only "pause" can save the words.
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);
  await page.keyboard.type('Saved on the way out.');
  expect(await readOnPhone(device, `${VAULT}/Untitled.md`)).toBe('');
  await shell(device, 'input keyevent KEYCODE_HOME');
  // Long enough for a busy emulator; the usual save can't come at all while the clock is stopped.
  await expect
    .poll(() => readOnPhone(device, `${VAULT}/Untitled.md`), { timeout: 30_000 })
    .toBe('Saved on the way out.');
  page = await startEien(device, { keep: true });
  await expect(titles(page)).toHaveText(['Untitled']);
});

test('what a crash left is recovered when Eien starts again', async ({ device }) => {
  let page = await startEien(device);
  await expect(page.locator('.shell')).toBeVisible();
  await putOnPhone(device, `${VAULT}/Fic/.Mend.md.eien.tmp`, 'Mended, never renamed.');
  await putOnPhone(device, `${VAULT}/.Tear.md.eien-case`, 'Cut between the steps.');
  page = await startEien(device, { keep: true });
  await expect(page.locator('.shell')).toBeVisible();
  const fic = await listOnPhone(device, `${VAULT}/Fic`);
  expect(fic).toEqual([expect.stringMatching(/^Mend \(recovered [\d -]+\)\.md$/)]);
  expect(await readOnPhone(device, `${VAULT}/Fic/${fic[0]}`)).toBe('Mended, never renamed.');
  expect(await readOnPhone(device, `${VAULT}/Tear.md`)).toBe('Cut between the steps.');
});

test('a rename that only changes case, on Android’s shared storage', async ({ device }) => {
  // The shared storage ignores case: a plain rename from "tear.md" to "Tear.md" does nothing.
  const page = await startEien(device);
  await putOnPhone(device, `${VAULT}/tear.md`, 'Words.');
  await expect(titles(page)).toHaveText(['tear']);
  expect(await page.evaluate(() => window.eien.vault.move('tear.md', 'Tear.md'))).toEqual({
    ok: true,
  });
  expect(await listOnPhone(device, VAULT)).toEqual(['Tear.md']);
  expect(await readOnPhone(device, `${VAULT}/Tear.md`)).toBe('Words.');
});

test('a move never takes a name another file has, by any case', async ({ device }) => {
  const page = await startEien(device);
  await putOnPhone(device, `${VAULT}/Draft.md`, 'Mine.');
  await putOnPhone(device, `${VAULT}/Chapter.md`, 'Synced in from the laptop.');
  await expect(titles(page)).toHaveCount(2);
  expect(await page.evaluate(() => window.eien.vault.move('Draft.md', 'chapter.md'))).toEqual({
    ok: false,
    reason: 'taken',
  });
  expect(await readOnPhone(device, `${VAULT}/Chapter.md`)).toBe('Synced in from the laptop.');
  expect(await readOnPhone(device, `${VAULT}/Draft.md`)).toBe('Mine.');
});

test('a lone surrogate saved reads back as the version saved: no false conflict', async ({
  device,
}) => {
  // Java writes a lone surrogate as "?"; the version is the hash of U+FFFD, as TextEncoder
  // writes it. Unmatched, every later save would find the note "changed elsewhere".
  const page = await startEien(device);
  await expect(page.locator('.shell')).toBeVisible();
  const versions = await page.evaluate(async () => {
    const saved = await window.eien.vault.write('Odd.md', 'a\uD800b', null);
    const read = await window.eien.vault.read('Odd.md');
    return [saved.ok ? saved.version : 'refused', read?.version];
  });
  expect(versions[1]).toBe(versions[0]);
  expect(await readOnPhone(device, `${VAULT}/Odd.md`)).toBe('a\uFFFDb');
});

test('Android’s back: the ⋯ closes first, then a pane back at a time, then Eien steps aside', async ({
  device,
}) => {
  const page = await startEien(device);
  await putOnPhone(device, `${VAULT}/Fic/Tear.md`, 'The scarf tore.\n');
  await page.locator('.phone-bar__back').click(); // to the tree
  await page.locator('.sidebar').getByText('Fic', { exact: true }).click();
  await titles(page).filter({ hasText: 'Tear' }).click();
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'page');
  await page.locator('.phone-bar__more').click();
  await expect(page.locator('.menu')).toBeVisible();
  const backKey = () => shell(device, 'input keyevent KEYCODE_BACK');
  await backKey();
  await expect(page.locator('.menu')).toHaveCount(0);
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'page');
  await backKey();
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'list');
  await backKey();
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'sidebar');
  await backKey();
  await expect.poll(() => resumed(device)).not.toContain(PKG); // stepped aside, not ended
  expect((await shell(device, `pidof ${PKG}`)).trim()).not.toBe('');
});

test('Android’s back closes the versions panel and the outline cards before going back', async ({
  device,
}) => {
  const page = await startEien(device);
  await putOnPhone(device, `${VAULT}/Fic/.eien-folder.json`, '{"book":{}}');
  await putOnPhone(device, `${VAULT}/Fic/Tear.md`, 'The scarf tore.\n');
  await titles(page).filter({ hasText: 'Tear' }).click();
  const choose = async (label: string) => {
    await page.locator('.phone-bar__more').click();
    await page
      .locator('.menu [role^="menuitem"]', { hasText: new RegExp(`^${label}$`, 'u') })
      .click();
  };
  const backKey = () => shell(device, 'input keyevent KEYCODE_BACK');
  await choose('Seal');
  await choose('Versions');
  await expect(page.getByRole('complementary', { name: 'Versions' })).toBeVisible();
  await backKey();
  await expect(page.getByRole('complementary', { name: 'Versions' })).toBeHidden();
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'page');
  await choose('Outline cards');
  await expect(page.locator('.board')).toBeVisible();
  await backKey();
  await expect(page.locator('.board')).toBeHidden();
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'page');
  await backKey();
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'list');
});

test('Android’s back closes the settings before anything else', async ({ device }) => {
  const page = await startEien(device);
  await putOnPhone(device, `${VAULT}/Tear.md`, 'Words.\n');
  await titles(page).filter({ hasText: 'Tear' }).click();
  await page.locator('.phone-bar__more').click();
  await page.locator('.menu [role^="menuitem"]', { hasText: /^Settings$/u }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await shell(device, 'input keyevent KEYCODE_BACK');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.locator('.shell')).toHaveAttribute('data-shown', 'page');
});

test('trash goes to .eien/trash, where any device can take it back', async ({ device }) => {
  const page = await startEien(device);
  await putOnPhone(device, `${VAULT}/Tear.md`, 'Words to keep.');
  await expect(titles(page)).toHaveText(['Tear']);
  await page.evaluate(() => window.eien.vault.trash('Tear.md'));
  await expect(titles(page)).toHaveCount(0);
  const [stamp] = await listOnPhone(device, `${VAULT}/.eien/trash`);
  expect(await readOnPhone(device, `${VAULT}/.eien/trash/${stamp}/Tear.md`)).toBe('Words to keep.');
});

test('this device’s settings are kept after a restart', async ({ device }) => {
  let page = await startEien(device);
  await expect(page.locator('.shell')).toBeVisible();
  await page.evaluate(() => window.eien.settings.set('appearance.scheme', 'night'));
  // Preferences reaches the disk a moment later (Android's apply()); only then is the app ended.
  await expect
    .poll(() => shell(device, `run-as ${PKG} cat shared_prefs/CapacitorStorage.xml`))
    .toContain('night');
  page = await startEien(device, { keep: true });
  expect(await page.evaluate(() => window.eien.settings.read())).toMatchObject({
    'appearance.scheme': 'night',
  });
  expect(await readOnPhone(device, `${VAULT}/.eien/config.json`)).toBeNull(); // not the vault’s
});

test('an export goes to Documents/Eien Exports', async ({ device }) => {
  const page = await startEien(device);
  await expect(page.locator('.shell')).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.eien.out.saveAs('Tear', { kind: 'html', text: '<p>“One.”</p>' }),
    ),
  ).toBe('Eien Exports/Tear.html');
  expect(await readOnPhone(device, `${EXPORTS}/Tear.html`)).toBe('﻿<p>“One.”</p>');
});
