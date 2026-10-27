// Find and replace in the open note (spec §4, Find in the note): ⌘F, the
// count, the next and previous match, Replace and Replace all (each one step
// of the note's history), Esc, Live and Source, and the active page in a
// split. Saves are waited for on the file itself, never on a time.

import { join } from 'node:path';
import type { Locator, Page } from '@playwright/test';
import { clickMenu, editorContent, expect, readQuietly, test } from './launch';

const BELLS = 'The bell rang. Bells. The bell again.\n';
const REPLACE_KEY = process.platform === 'darwin' ? 'Meta+Alt+f' : 'Control+h';

test.use({
  vaultFiles: {
    'Bells.md': BELLS,
    'Snow.md': 'Snow on the walls. Snow on the gate.\n',
  },
});

const row = (page: Page, title: string) => page.locator('.note-row', { hasText: title });
const leaves = (page: Page) => page.locator('.page__pages > .page__leaf');
const active = (page: Page) => page.locator('.page__pages > .page__leaf[data-active]');
const bar = (where: Locator | Page) => where.locator('.find');
const findField = (where: Locator | Page) => bar(where).getByRole('textbox', { name: 'Find' });
const replaceField = (where: Locator | Page) =>
  bar(where).getByRole('textbox', { name: 'Replace' });
const count = (where: Locator | Page) => bar(where).getByRole('status');

async function open(page: Page, title: string, words: string): Promise<void> {
  await row(page, title).click();
  await expect(editorContent(page)).toContainText(words);
}

/** Find `query` from the start of the note, with ⌘F (Ctrl+F) in its text. */
async function findFromStart(page: Page, query: string): Promise<void> {
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+f');
  await expect(findField(page)).toBeFocused();
  await page.keyboard.type(query);
}

test('⌘F finds in the note: the matches marked, the count, next and previous', async ({ page }) => {
  await open(page, 'Bells', 'The bell rang.');
  await expect(bar(page)).toBeHidden();
  await findFromStart(page, 'bell');
  await expect(count(page)).toHaveText('1 of 3');
  await expect(page.locator('.cm-searchMatch')).toHaveCount(3);
  await expect(page.locator('.cm-searchMatch-selected')).toHaveText('bell');
  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('2 of 3');
  await expect(page.locator('.cm-searchMatch-selected')).toHaveText('Bell');
  await page.keyboard.press('ControlOrMeta+g');
  await expect(count(page)).toHaveText('3 of 3');
  await page.keyboard.press('ControlOrMeta+Shift+g');
  await expect(count(page)).toHaveText('2 of 3');
  await page.keyboard.press('Shift+Enter');
  await expect(count(page)).toHaveText('1 of 3');
  await page.keyboard.type('x');
  await expect(count(page)).toHaveText('No matches');
});

test('Esc shuts it, the keyboard back in the text at the current match', async ({
  page,
  vault,
}) => {
  await open(page, 'Bells', 'The bell rang.');
  await findFromStart(page, 'bell');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('3 of 3');
  await page.keyboard.press('Escape');
  await expect(bar(page)).toBeHidden();
  await expect(page.locator('.cm-searchMatch')).toHaveCount(0);
  // The third match is still chosen, the caret in the text: past it, the writer types there.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(' tolled');
  await expect
    .poll(() => readQuietly(join(vault ?? '', 'Bells.md')))
    .toBe('The bell rang. Bells. The bell tolled again.\n');
});

test('Replace all is one step: ⌘Z puts every match back', async ({ page, vault }) => {
  const file = join(vault ?? '', 'Bells.md');
  await open(page, 'Bells', 'The bell rang.');
  await editorContent(page).click();
  await page.keyboard.press(REPLACE_KEY);
  await expect(findField(page)).toBeFocused();
  await page.keyboard.type('bell');
  await replaceField(page).click();
  await expect(replaceField(page)).toBeFocused();
  await page.keyboard.type('gong');
  await bar(page).getByRole('button', { name: 'Replace all' }).click();
  await expect(count(page)).toHaveText('No matches');
  await expect.poll(() => readQuietly(file)).toBe('The gong rang. gongs. The gong again.\n');
  // Esc from any of the bar's controls, not only its fields.
  await page.keyboard.press('Escape');
  await expect(bar(page)).toBeHidden();
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => readQuietly(file)).toBe(BELLS);
});

test('Replace takes one match at a time, Enter in its field, from the menu’s Find and Replace', async ({
  app,
  page,
  vault,
}) => {
  const file = join(vault ?? '', 'Bells.md');
  await open(page, 'Bells', 'The bell rang.');
  await clickMenu(app, 'Edit', 'Find', 'Find and Replace…');
  await expect(findField(page)).toBeFocused();
  await page.keyboard.type('bell');
  await expect(count(page)).toHaveText('1 of 3');
  await replaceField(page).click();
  await page.keyboard.type('gong');
  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('1 of 2');
  await expect.poll(() => readQuietly(file)).toBe('The gong rang. Bells. The bell again.\n');
});

test('the Edit menu’s Find items, with their keys', async ({ app, page }) => {
  await expect(page.locator('.note-row').first()).toBeVisible();
  const items = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()
      ?.items.find((menu) => menu.label === 'Edit')
      ?.submenu?.items.find((item) => item.label === 'Find')
      ?.submenu?.items.map((item) => [item.label, item.accelerator ?? null]),
  );
  const mac = process.platform === 'darwin';
  expect(items).toEqual([
    ['Find…', 'CmdOrCtrl+F'],
    ['Find and Replace…', mac ? 'CmdOrCtrl+Alt+F' : 'Ctrl+H'],
    ['Find Next', 'CmdOrCtrl+G'],
    ['Find Previous', 'CmdOrCtrl+Shift+G'],
  ]);
});

test('finds in Source as in Live', async ({ app, page }) => {
  await open(page, 'Bells', 'The bell rang.');
  await clickMenu(app, 'View', 'Source');
  await expect(page.locator('.cm-editor.eien-source')).toBeVisible();
  await findFromStart(page, 'bell');
  await expect(count(page)).toHaveText('1 of 3');
  await page.keyboard.press('Enter');
  await expect(count(page)).toHaveText('2 of 3');
});

test.describe('in a split', () => {
  test.beforeEach(({ page }) => page.setViewportSize({ width: 1600, height: 900 }));

  test('finds on the active page alone', async ({ app, page }) => {
    await open(page, 'Bells', 'The bell rang.');
    await row(page, 'Snow').click({ modifiers: ['ControlOrMeta'] });
    await expect(leaves(page)).toHaveCount(2);
    await expect(active(page).locator('.cm-content')).toContainText('Snow on the walls.');
    // From the menu, as the window's own command: the active page's note is searched.
    await clickMenu(app, 'Edit', 'Find', 'Find…');
    await expect(findField(active(page))).toBeFocused();
    await page.keyboard.type('snow');
    await expect(count(active(page))).toHaveText('1 of 2');
    await expect(bar(leaves(page).nth(0))).toBeHidden();
    // The other page, given the keyboard, finds in its own note.
    await leaves(page).nth(0).locator('.cm-content').click();
    await expect(leaves(page).nth(0)).toHaveAttribute('data-active');
    await page.keyboard.press('ControlOrMeta+f');
    await expect(findField(leaves(page).nth(0))).toBeFocused();
    await page.keyboard.type('bell');
    await expect(count(leaves(page).nth(0))).toHaveText(/ of 3$/);
  });
});
