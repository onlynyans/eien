// Adversarial: ways the real app can lose or damage what's on disk.

import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { closeApp, editorContent, expect, readQuietly, test } from './launch';

test.use({
  vaultFiles: {
    'Ideas.md': 'Snow on the walls.\n',
    '.eien/config.json': '{}\n',
  },
});

const fileIn = (vault: string | null, path: string) => {
  if (!vault) throw new Error('no vault');
  return join(vault, ...path.split('/'));
};
/** '' while the file can't be read, so a poll tries again (./launch.ts). */
const readIn = (vault: string | null, path: string) => readQuietly(fileIn(vault, path));

for (const rewrite of [
  // The control: nobody else touches the file.
  { what: 'nobody else touched it', bytes: null },
  // Same words, Windows line endings: what an editor set to CRLF writes on save.
  { what: 'another editor re-saved it with CRLF line endings', bytes: 'Snow on the walls.\r\n' },
]) {
  test(`typing in the open note is saved when ${rewrite.what}`, async ({ app, page, vault }) => {
    await page.locator('.note-row', { hasText: 'Ideas' }).click();
    await expect(page.locator('.title')).toHaveText('Ideas');
    if (rewrite.bytes !== null) writeFileSync(fileIn(vault, 'Ideas.md'), rewrite.bytes);
    await page.waitForTimeout(1000); // the watcher has reported it
    await editorContent(page).click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type('And the scarf.');
    await page.waitForTimeout(2500); // well past the 800 ms autosave pause
    await closeApp(app); // quitting saves too
    expect(readIn(vault, 'Ideas.md')).toContain('And the scarf.');
  });
}

test('undo after a change from elsewhere was shown never discards that change for good', async ({
  page,
  vault,
}) => {
  await page.locator('.note-row', { hasText: 'Ideas' }).click();
  await expect(page.locator('.title')).toHaveText('Ideas');
  await page.waitForTimeout(500);
  writeFileSync(fileIn(vault, 'Ideas.md'), 'Their version, from the other device.\n');
  await expect(page.locator('.cm-line').first()).toHaveText(
    'Their version, from the other device.',
    { timeout: 5000 },
  );
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+z'); // the writer's usual undo
  await page.waitForTimeout(2500); // past the autosave pause
  const words = readdirSync(fileIn(vault, ''))
    .filter((name) => name.endsWith('.md'))
    .map((name) => readIn(vault, name));
  expect(
    words.some((text) => text.includes('Their version')),
    `the vault's notes now hold ${JSON.stringify(words)}`,
  ).toBe(true);
});

test('a folder renamed elsewhere under the open note closes it, and isn’t made again', async ({
  page,
  vault,
}) => {
  mkdirSync(fileIn(vault, 'Fic'));
  writeFileSync(fileIn(vault, 'Fic/Seventeen.md'), 'In a folder.\n');
  await page.locator('.tree-row__label', { hasText: /^Fic$/ }).click();
  await page.locator('.note-row', { hasText: 'Seventeen' }).click();
  await expect(page.locator('.title')).toHaveText('Seventeen');
  renameSync(fileIn(vault, 'Fic'), fileIn(vault, 'Fiction'));
  await expect(page.locator('.page__empty')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1500); // past any save that might have been due
  expect(existsSync(fileIn(vault, 'Fic'))).toBe(false);
  expect(readIn(vault, 'Fiction/Seventeen.md')).toBe('In a folder.\n');
});

test('two vault settings chosen in quick succession leave a readable config file', async ({
  page,
  vault,
}) => {
  await page.locator('.note-row', { hasText: 'Ideas' }).waitFor();
  // Both choices of the one vault setting, clicked one straight after the other, a few times.
  await page.evaluate(async () => {
    const button = (value: string) =>
      document.querySelector<HTMLButtonElement>(`dialog.settings button[data-value="${value}"]`);
    for (let i = 0; i < 5; i++) {
      button('arabic')?.click();
      button('roman')?.click();
      await new Promise((done) => setTimeout(done, 200));
    }
  });
  await page.waitForTimeout(1000);
  const text = readIn(vault, '.eien/config.json');
  expect(() => JSON.parse(text), `config.json now holds ${JSON.stringify(text)}`).not.toThrow();
  await expect(page.locator('.settings__problem')).toBeHidden();
});

test.describe('a vault settings file saved with a byte-order mark', () => {
  test.use({
    vaultFiles: {
      'Book/a.md': 'x',
      'Book/b.md': 'y',
      'Book/.eien-folder.json': '﻿{"book":{}}',
      '.eien/config.json': '﻿{ "books.numerals": "arabic" }\n',
    },
  });

  test('is read, and can be changed', async ({ page, vault }) => {
    await page.locator('.tree-row__label', { hasText: /^Book$/ }).click();
    await expect(page.locator('.note-row__ord')).toHaveText(['1', '2']); // a book, numbered as the file says
    await page.getByRole('button', { name: 'Settings' }).click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog.getByRole('navigation').getByRole('button', { name: 'Writing' }).click();
    await dialog.getByRole('button', { name: 'i ii iii' }).click();
    await expect(page.locator('.note-row__ord')).toHaveText(['i', 'ii']);
    await expect.poll(() => readIn(vault, '.eien/config.json')).toBe('{}\n');
  });
});
