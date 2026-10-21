// Tags on the page (backlog #13; docs/design/explorations/tags.md), in each
// layout's place: A's running head, B's slips under the title, C's colophon.
// The page adds and takes off front matter's tags, and only those: the file
// on disk changes there and nowhere else, and a #tag typed in the words has
// no ×, staying where the writer put it.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { editorContent, expect, test } from './launch';

const NOTE = '---\ntitle: "Kept: as written"  # mine\ntags: [fic/aot]\n---\nA scene. #draft\n';
test.use({
  vaultFiles: { 'Note.md': NOTE, 'Other.md': '---\ntags: [posted]\n---\nMore words.\n' },
});

type Layout = 'band' | 'slip' | 'runhead';
/** Where each layout puts the tags (src/ui/chrome/layout-spec.ts, TagSlot). */
const PLACES: Record<Layout, string> = {
  band: '.sheet__head .sheet__tags',
  slip: '.title-tags',
  runhead: '.colophon__tags',
};

const readIn = (vault: string | null, path: string) =>
  readFileSync(join(vault ?? '', path), 'utf8');

/** A tag's row in the sidebar: "#name" and its count. */
const tagRow = (page: Page, name: string) =>
  page.locator('.tree-row__name').filter({ hasText: new RegExp(`^#${name}\\d+$`) });

for (const layout of ['band', 'slip', 'runhead'] as const) {
  test.describe(`the ${layout} layout`, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('shows the note’s tags in its place, adds and takes off front matter’s, and saves them', async ({
      page,
      vault,
    }) => {
      await page.locator('.note-row', { hasText: 'Note' }).click();
      const tags = page.locator(`${PLACES[layout]} .tag-set`);
      await expect(tags).toBeVisible();
      await expect(page.locator('.tag-set')).toHaveCount(1); // one place at a time
      await expect(tags.locator('.tag')).toHaveText(['#fic/aot', '#draft']);
      await expect(tags.locator('.tag--text')).toHaveText('#draft');

      // Add one of the vault's tags: the menu lists it with its count.
      await tags.getByRole('button', { name: 'Add a tag' }).click();
      const field = tags.getByRole('combobox', { name: 'Add a tag' });
      await expect(field).toBeFocused();
      await field.fill('pos');
      const options = page.getByRole('option');
      await expect(options).toHaveText(['#posted1', 'Make #posnew tag']);
      await page.keyboard.press('Enter');
      await expect(tags.locator('.tag')).toHaveText(['#fic/aot', '#posted', '#draft']);
      await expect
        .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
        .toBe(NOTE.replace('tags: [fic/aot]', 'tags: [fic/aot, posted]'));
      await expect(tagRow(page, 'posted')).toContainText('2');

      // A tag no note has yet: "Make #…".
      await field.fill('#Brand-new');
      await expect(options.last()).toHaveText('Make #Brand-newnew tag');
      await page.keyboard.press('ArrowUp'); // round to the last
      await expect(options.last()).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Enter');
      await expect
        .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
        .toContain('tags: [fic/aot, posted, Brand-new]');
      // ⌫ in the empty field takes the last of front matter's off; Esc closes, the + has the keyboard.
      await expect(field).toHaveValue('');
      await page.keyboard.press('Backspace');
      await expect
        .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
        .toContain('tags: [fic/aot, posted]\n');
      await page.keyboard.press('Escape');
      await expect(field).toBeHidden();
      await expect(tags.getByRole('button', { name: 'Add a tag' })).toBeFocused();

      // Take one off with its ×: only front matter changes; the words are as they were.
      // Its × waits for the pointer, taking no room till then.
      await tags.locator('.tag', { hasText: '#fic/aot' }).hover();
      await tags.getByRole('button', { name: 'Take #fic/aot off' }).click();
      await expect(tags.locator('.tag')).toHaveText(['#posted', '#draft']);
      await expect
        .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
        .toBe(NOTE.replace('tags: [fic/aot]', 'tags: [posted]'));
      // From the keyboard too: Tab reaches the next ×, which shows as it does.
      const off = tags.getByRole('button', { name: 'Take #posted off' });
      await off.focus();
      await expect(off).toHaveCSS('opacity', '1');
      await expect(page.locator('.tree-row__name', { hasText: /^#fic/ })).toHaveCount(0);
    });

    test('a tag typed in the text has no ×: choosing it shows where it is', async ({
      page,
      vault,
    }) => {
      await page.locator('.note-row', { hasText: 'Note' }).click();
      const tags = page.locator(`${PLACES[layout]} .tag-set`);
      await expect(tags.locator('.tag--text')).toHaveText('#draft');
      await expect(tags.getByRole('button', { name: 'Take #draft off' })).toHaveCount(0);
      await tags.locator('.tag--text').click();
      await expect(editorContent(page)).toBeFocused();
      await page.keyboard.type('#kept'); // typed over the chosen #draft
      await expect
        .poll(() => readIn(vault, 'Note.md'), { timeout: 5000 })
        .toContain('A scene. #kept\n');
      // The head follows the words once the typing pauses.
      await expect(tags.locator('.tag--text')).toHaveText('#kept');
    });

    test('in the narrowest page, the tags stay on it, to be seen and pressed', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 600 }); // the page at its 360 px
      await page.locator('.note-row', { hasText: 'Note' }).click();
      const first = page.locator(`${PLACES[layout]} .tag`).first();
      await expect(first).toBeVisible();
      const sheet = await page.locator('.page').boundingBox();
      const tag = await first.boundingBox();
      expect(tag?.x ?? 0).toBeGreaterThanOrEqual(sheet?.x ?? 0);
      await first.hover(); // nothing lies over it
      await expect(first.getByRole('button', { name: 'Take #fic/aot off' })).toBeVisible();
    });

    test('the # key on the page opens the field, with the keyboard in it', async ({ page }) => {
      await page.locator('.note-row', { hasText: 'Other' }).click();
      await page.locator('.title').focus();
      await page.keyboard.press('#');
      await expect(page.getByRole('combobox', { name: 'Add a tag' })).toBeFocused();
      // Typed in the words, # is a character, never the field.
      await page.keyboard.press('Escape');
      await editorContent(page).click();
      await page.keyboard.press('#');
      await expect(page.getByRole('combobox', { name: 'Add a tag' })).toBeHidden();
    });
  });
}
