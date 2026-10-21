// Adversarial: phase 9b on the real app — what reaches today's tally (only the
// writer's own writing, all of it), and the book's goal field — where a unit
// test can't show it: CodeMirror's undo of a restore, and a quit. A comment
// on a test describes the defect it caught, as it was before the fix.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { ALONE, clickMenu, closeApp, editorContent, expect, launchApp, test } from './launch';

test.use({
  vaultFiles: {
    'Loose.md': 'One two three.\n',
    'Other.md': 'Another note here.\n',
    'Scarf/.eien-folder.json': '{"order":["Tear.md","Mend.md"],"book":{"goal":40000}}',
    'Scarf/Tear.md': 'The scarf caught on the gate.\n',
    'Scarf/Mend.md': 'She mended it by the fire, slowly.\n',
  },
});

const today = (page: Page) => page.locator('.colophon__today');
const book = (page: Page) => page.locator('.colophon__book');
const words = (page: Page) => page.locator('.colophon__words');
const read = (vault: string | null, path: string) =>
  readFileSync(join(vault ?? '', ...path.split('/')), 'utf8');

async function open(page: Page, title: string): Promise<void> {
  await page.locator('.note-row', { hasText: title }).click();
  await expect(page.locator('.title')).toHaveText(title);
}

async function typeAtEnd(page: Page, text: string): Promise<void> {
  // At the text's start: on a narrow window the versions panel lies over the page's middle.
  await editorContent(page).click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

/**
 * Hold the window's write of `path` while it gives the note an id (a seal's own save) for
 * `ms`, as a slow machine does. Through Electron's own table of invoke handlers: the window
 * itself is left as it is.
 */
async function slowSealOf(app: ElectronApplication, path: string, ms: number): Promise<void> {
  await app.evaluate(
    ({ ipcMain }, [path, ms]) => {
      type Handler = (...args: unknown[]) => unknown;
      const handlers = (ipcMain as unknown as { _invokeHandlers?: Map<string, Handler> })
        ._invokeHandlers;
      const write = handlers?.get('vault:write');
      if (!handlers || !write) throw new Error('Electron’s invoke handlers have moved');
      handlers.set('vault:write', async (event, at, text, expected) => {
        if (at === path && typeof text === 'string' && text.includes('\nid: ')) {
          await new Promise((done) => setTimeout(done, ms));
        }
        return write(event, at, text, expected);
      });
    },
    [path, ms] as const,
  );
}

test('another device’s words arriving while a seal writes: both kept, neither counted here', async ({
  app,
  page,
  vault,
}) => {
  // counters.spec.ts once waited for the seal line to be "not empty", which "Not sealed yet"
  // already is: on a slow runner it wrote another device's words while the seal was still giving
  // the note its id. Then both have changed, and the page's words go to a conflict copy, as
  // spec §3 says. Here that moment is made to happen, and what's kept is checked.
  await open(page, 'Loose');
  await typeAtEnd(page, ' Four five.');
  await expect.poll(() => read(vault, 'Loose.md')).toContain('Four five');
  await expect(today(page)).toHaveText('Today +2');
  await slowSealOf(app, 'Loose.md', 1500);
  await clickMenu(app, 'File', 'Seal');
  writeFileSync(join(vault ?? '', 'Loose.md'), 'One two three. Seven eight nine ten.\n');
  await expect(page.locator('.seal-line')).toHaveText(/^Sealed /u, { timeout: 10_000 });
  // The other device's words where they were; the page's, with the id, in a copy beside them.
  expect(read(vault, 'Loose.md')).toBe('One two three. Seven eight nine ten.\n');
  const copy = readdirSync(vault ?? '').find((name) => name.startsWith('Loose (conflict '));
  expect(copy).toBeDefined();
  expect(read(vault, copy ?? '')).toMatch(/^---\nid: \w+\n---\nOne two three\.\n Four five\.\n?$/u);
  await expect(words(page)).toHaveText('5 words');
  await expect(today(page)).toHaveText('Today +2'); // no one wrote the copy, nor the other words
});

test('⌘Z after a restore isn’t writing: today doesn’t gain the words the restore took away', async ({
  app,
  page,
}) => {
  // A restore is amended in as an undoable change with no userEvent, so it isn't counted; but
  // the ⌘Z that takes it back carries userEvent "undo", so editor.ts calls it the writer's and
  // today's tally gains every word the restore had removed (here +5 more; a chapter, thousands).
  await open(page, 'Loose');
  await clickMenu(app, 'File', 'Seal');
  await expect(page.locator('.seal-line')).toHaveText('Sealed just now');
  await typeAtEnd(page, ' Four five six seven eight.');
  await expect(words(page)).toHaveText('8 words');
  await expect(today(page)).toHaveText('Today +5');
  // Past CodeMirror's 500 ms grouping, so the restore is its own step in the undo history.
  await page.waitForTimeout(700);

  await page.getByRole('button', { name: 'Versions', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Versions' });
  await expect(panel.locator('.version__when')).toHaveText(['Draft · now', 'Sealed just now']);
  await panel
    .getByRole('button', { name: /^Restore/ })
    .first()
    .click();
  await expect(page.locator('.seal-line')).toHaveText('Restored — the draft was sealed first');
  await expect(words(page)).toHaveText('3 words');
  await expect(today(page)).toHaveText('Today +5'); // the restore isn't writing

  await editorContent(page).click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('ControlOrMeta+z'); // the restore taken back
  await expect(words(page)).toHaveText('8 words');
  await page.waitForTimeout(600); // the count catches up after a pause
  await expect(today(page)).toHaveText('Today +5');
});

test('words typed just before quitting are in today’s tally after the restart', async ({
  app,
  page,
  userData,
  vault,
}) => {
  // WordCount counts 250 ms after typing pauses; the close only saves the note (app.ts:
  // onBeforeClose → note.flush), so a quit inside that pause saves the words to the file and
  // drops them from today's tally — the writer's last sentence of the night isn't counted.
  await open(page, 'Loose');
  await typeAtEnd(page, ' Four five.');
  await closeApp(app); // ⌘Q at once
  expect(read(vault, 'Loose.md')).toContain('Four five.'); // the words were saved...
  const again = await launchApp(userData, vault);
  try {
    const next = await again.firstWindow();
    await expect(next.locator('.colophon__today')).toHaveText('Today +2'); // ...and counted
  } finally {
    await closeApp(again);
  }
});

test('opening, switching, renaming and moving notes is no one writing', ALONE, async ({ page }) => {
  await open(page, 'Loose');
  await open(page, 'Other');
  // Typed, then another note opened inside the count's pause: counted, for the note typed in.
  await typeAtEnd(page, ' Plus two.');
  await open(page, 'Loose');
  await expect(today(page)).toHaveText('Today +2');
  // Renamed while open.
  await page.locator('.title').click();
  await page.keyboard.type('Loosened');
  await page.keyboard.press('Enter');
  await expect(page.locator('.title')).toHaveText('Loosened');
  // Moved into the book while open: its words join the book, and none join today.
  await page
    .locator('.note-row', { hasText: 'Loosened' })
    .dragTo(page.locator('.tree-row__label', { hasText: 'Scarf' }));
  await expect(page.locator('.crumbs')).toHaveText('Scarf');
  await expect(book(page)).toHaveText('Book 16 / 40,000'); // 6 + 7 + 3
  await expect(today(page)).toHaveText('Today +2');
});

test('the goal field leaves the goal as it was on Esc or a click elsewhere', async ({
  page,
  vault,
}) => {
  await page.locator('.tree-row__label', { hasText: 'Scarf' }).click();
  await open(page, 'Tear');
  await expect(book(page)).toHaveText('Book 13 / 40,000');
  const settings = read(vault, 'Scarf/.eien-folder.json');
  const field = page.getByRole('textbox', { name: 'Word goal for Scarf' });
  const ask = async () => {
    await page.locator('.tree-row__label', { hasText: 'Scarf' }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Word goal…' }).click();
    await expect(field).toHaveValue('40,000');
  };

  await ask();
  await field.fill('');
  await field.press('Escape');
  await expect(field).toBeHidden();

  await ask();
  await field.fill('5');
  await page.locator('.colophon').click();
  await expect(field).toBeHidden();

  await page.waitForTimeout(500);
  expect(read(vault, 'Scarf/.eien-folder.json')).toBe(settings);
  await expect(book(page)).toHaveText('Book 13 / 40,000');
});
