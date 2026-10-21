// Phase 4 on the real app: the editor's three views, its formatting by key,
// menu and selection bar, checkboxes, pictures, and links (spec §4).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, editorContent, editorLines, expect, test } from './launch';

/** A 1×1 PNG. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const MARKS = [
  'A **bold** word and a [link](https://archiveofourown.org/works/1).',
  '',
  'See [[Ideas]] too.',
  '',
  '- [ ] Summary',
  '',
  '![cover](art/cover.png)',
  '',
  '![web](https://example.com/a.png)',
  '',
  'Last line.',
  '',
].join('\n');

test.use({
  vaultFiles: {
    'Marks.md': MARKS,
    'art/cover.png': PIXEL,
    'Ideas.md': 'Snow on the walls.\n',
    'Plain.md': 'soft words here\n',
  },
});

const readIn = (vault: string | null, path: string) =>
  readFileSync(join(vault ?? '', path), 'utf8');

async function open(page: Page, title: string): Promise<void> {
  await page.locator('.note-row', { hasText: title }).click();
  await expect(page.locator('.title')).toHaveText(title);
}

/** Put the caret on the note's last written line, away from the lines under test. */
async function caretToEnd(page: Page): Promise<void> {
  await editorLines(page).filter({ hasText: 'Last line.' }).click();
}

/** Select the first word of the first line with the keyboard. */
async function selectFirstWord(page: Page, length: number): Promise<void> {
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+Home');
  for (let i = 0; i < length; i++) await page.keyboard.press('Shift+ArrowRight');
}

test.describe('Live', () => {
  test('hides marks away from the caret, and shows them on its line', async ({ page }) => {
    await open(page, 'Marks');
    await caretToEnd(page);
    await expect(editorLines(page).first()).toHaveText('A bold word and a link.');
    await expect(editorLines(page).nth(2)).toHaveText('See Ideas too.');
    await page.keyboard.press('ControlOrMeta+Home');
    await expect(editorLines(page).first()).toHaveText(MARKS.split('\n')[0] ?? '');
  });

  test('ticking a checkbox writes it to the file, and undo unticks it', async ({ page, vault }) => {
    await open(page, 'Marks');
    await caretToEnd(page);
    const box = page.locator('input.eien-check');
    await expect(box).not.toBeChecked();
    await box.click();
    await expect
      .poll(() => readIn(vault, 'Marks.md'), { timeout: 5000 })
      .toContain('- [x] Summary');
    await expect(box).toBeChecked();
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => readIn(vault, 'Marks.md'), { timeout: 5000 }).toBe(MARKS);
  });

  test('shows a picture beside the note, and never fetches one from the web', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (request) => asked.push(request.url()));
    await open(page, 'Marks');
    const picture = page.locator('img.eien-image');
    await expect(picture).toHaveAttribute('src', /^blob:/);
    await expect.poll(() => picture.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(1);
    await expect(page.locator('.eien-image-note')).toContainText('not loaded');
    expect(asked.filter((url) => url.includes('example.com'))).toEqual([]);
  });
});

test.describe('formatting', () => {
  test('⌘B (Ctrl+B) bolds the selection and saves; undo takes it back', async ({ page, vault }) => {
    await open(page, 'Plain');
    await selectFirstWord(page, 4);
    await page.keyboard.press('ControlOrMeta+b');
    await expect
      .poll(() => readIn(vault, 'Plain.md'), { timeout: 5000 })
      .toBe('**soft** words here\n');
    await page.keyboard.press('ControlOrMeta+b'); // the same key again unbolds
    await expect.poll(() => readIn(vault, 'Plain.md'), { timeout: 5000 }).toBe('soft words here\n');
    await page.keyboard.press('ControlOrMeta+z');
    await expect
      .poll(() => readIn(vault, 'Plain.md'), { timeout: 5000 })
      .toBe('**soft** words here\n');
  });

  test('the Format menu formats the selection', async ({ app, page, vault }) => {
    await open(page, 'Plain');
    await selectFirstWord(page, 4);
    await clickMenu(app, 'Format', 'Italic');
    await expect
      .poll(() => readIn(vault, 'Plain.md'), { timeout: 5000 })
      .toBe('*soft* words here\n');
    await clickMenu(app, 'Format', 'Heading 2');
    await expect
      .poll(() => readIn(vault, 'Plain.md'), { timeout: 5000 })
      .toBe('## *soft* words here\n');
  });

  test('headings: ⌘⌥1–3 on a Mac; Ctrl+Shift+1–3 elsewhere, where Ctrl+Alt is AltGr', async ({
    app,
    page,
    vault,
  }) => {
    const mac = process.platform === 'darwin';
    await open(page, 'Plain');
    await selectFirstWord(page, 4);
    // AltGr (Ctrl+Alt) types characters off a Mac: it's no heading key there.
    if (!mac) {
      await page.keyboard.press('Control+Alt+2');
      await page.waitForTimeout(300);
      expect(readIn(vault, 'Plain.md')).toBe('soft words here\n');
    }
    await page.keyboard.press(mac ? 'Meta+Alt+2' : 'Control+Shift+2');
    await expect
      .poll(() => readIn(vault, 'Plain.md'), { timeout: 5000 })
      .toBe('## soft words here\n');
    // The Format menu shows the same keys.
    const accelerators = await app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()
        ?.items.find((item) => item.label === 'Format')
        ?.submenu?.items.filter((item) => item.label.startsWith('Heading'))
        .map((item) => item.accelerator),
    );
    const held = mac ? 'CmdOrCtrl+Alt' : 'CmdOrCtrl+Shift';
    expect(accelerators).toEqual([`${held}+1`, `${held}+2`, `${held}+3`]);
  });

  test('the selection bar comes for a selection, formats it, and goes when typing', async ({
    page,
    vault,
  }) => {
    await open(page, 'Plain');
    const bar = page.getByRole('toolbar', { name: 'Format' });
    await editorContent(page).click();
    await expect(bar).toBeHidden(); // no selection, no bar
    await selectFirstWord(page, 4);
    await expect(bar).toBeVisible();
    await bar.getByRole('button', { name: 'Strikethrough' }).click();
    await expect(bar).toBeHidden();
    await expect
      .poll(() => readIn(vault, 'Plain.md'), { timeout: 5000 })
      .toBe('~~soft~~ words here\n');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(bar).toBeVisible();
    await page.keyboard.type('x');
    await expect(bar).toBeHidden();
  });
});

test.describe('views', () => {
  test('Source shows the file as written, with nothing drawn', async ({ page }) => {
    await open(page, 'Marks');
    await caretToEnd(page);
    await page.getByRole('button', { name: 'Source', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Source', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(editorLines(page)).toHaveText(MARKS.split('\n'));
    await expect(page.locator('input.eien-check, img.eien-image, .eien-image-note')).toHaveCount(0);
  });

  test('Reading hides every mark and takes no typing', async ({ page, vault }) => {
    await open(page, 'Marks');
    await page.getByRole('button', { name: 'Reading', exact: true }).click();
    await expect(editorContent(page)).toHaveAttribute('contenteditable', 'false');
    await expect(editorLines(page).first()).toHaveText('A bold word and a link.');
    await editorLines(page).last().click();
    await page.keyboard.type('nothing');
    await page.locator('input.eien-check').click({ force: true });
    await page.waitForTimeout(1200); // past the autosave pause: anything typed would be written by now
    expect(readIn(vault, 'Marks.md')).toBe(MARKS);
    await expect(page.locator('input.eien-check')).not.toBeChecked();
  });

  test('View → Next View goes Live, Source, Reading, and round again', async ({ app, page }) => {
    await open(page, 'Marks');
    const pressed = page.getByRole('group', { name: 'View' }).locator('[aria-pressed="true"]');
    await expect(pressed).toHaveAccessibleName('Live');
    for (const next of ['Source', 'Reading', 'Live']) {
      await clickMenu(app, 'View', 'Next View');
      await expect(pressed).toHaveAccessibleName(next);
    }
    await clickMenu(app, 'View', 'Reading');
    await expect(pressed).toHaveAccessibleName('Reading');
  });
});

test.describe('links', () => {
  /** Record what the app would open in the browser, instead of opening it. */
  async function catchOpened(app: ElectronApplication): Promise<() => Promise<string[]>> {
    await app.evaluate(({ shell }) => {
      const opened: string[] = [];
      Object.assign(globalThis, { opened });
      shell.openExternal = async (url) => void opened.push(url);
    });
    return () => app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened);
  }

  test('⌘-click (Ctrl-click) opens a web link in the browser; a plain click doesn’t', async ({
    app,
    page,
  }) => {
    const opened = await catchOpened(app);
    await open(page, 'Marks');
    await caretToEnd(page);
    const link = page.locator('.eien-link', { hasText: /^link$/ });
    await link.click({ modifiers: ['ControlOrMeta'] }); // from another line: the marks are hidden
    await expect.poll(opened).toEqual(['https://archiveofourown.org/works/1']);
    await caretToEnd(page);
    await link.click();
    await page.waitForTimeout(300);
    expect(await opened()).toHaveLength(1);
  });

  test('⌘-click on a [[link]] opens that note; in Reading a plain click does', async ({
    app,
    page,
  }) => {
    const opened = await catchOpened(app);
    await open(page, 'Marks');
    await caretToEnd(page);
    await page.locator('.eien-link', { hasText: 'Ideas' }).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.title')).toHaveText('Ideas');

    await open(page, 'Marks');
    await page.getByRole('button', { name: 'Reading', exact: true }).click();
    await page.locator('.eien-link', { hasText: /^link$/ }).click();
    await expect.poll(opened).toEqual(['https://archiveofourown.org/works/1']);
  });
});

test('the editor draws under the security policy, with no errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page, 'Marks');
  // CodeMirror's own styles arrive as constructed style sheets; a refused <style> would leave these unset.
  await expect(page.locator('.cm-editor')).toHaveCSS('display', 'flex');
  await expect(editorContent(page)).toHaveCSS('white-space', 'break-spaces');
  for (const view of ['Source', 'Reading', 'Live']) {
    await page.getByRole('button', { name: view, exact: true }).click();
  }
  expect(errors).toEqual([]);
});
