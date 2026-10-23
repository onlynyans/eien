// Phase 8 on the real app (spec §8): Copy as HTML puts the note's HTML on
// the system clipboard, as text and as HTML; pasting it into another note
// gives the Markdown back; Export saves it where the system's dialog says;
// plain text that is really HTML pastes as Markdown, code takes a paste as
// it is; typed quotes curl, and stay straight when the vault says so.

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, editorContent, expect, readQuietly, test } from './launch';

const CHAPTER = [
  '---',
  'id: N1',
  '---',
  '# The Scarf',
  '',
  '"Look," he said.',
  '',
  '"No."',
  '',
  '***',
  '',
  'She *mended* it.',
  '',
].join('\n');

const CHAPTER_HTML = [
  '<h2>The Scarf</h2>',
  '<p>“Look,” he said.</p>',
  '<p>“No.”</p>',
  '<p><br /></p><hr /><p><br /></p>',
  '<p>She <em>mended</em> it.</p>',
].join('\n');

test.use({
  vaultFiles: {
    'Chapter.md': CHAPTER,
    'Blank.md': '',
    'Code.md': 'Before.\n\n```\n\n```\n',
  },
});

/** For expect.poll: '' until the file is there (./launch.ts). */
const readIn = (vault: string | null, path: string) => readQuietly(join(vault ?? '', path));

async function open(page: Page, title: string): Promise<void> {
  await page.locator('.note-row', { hasText: title }).click();
  await expect(page.locator('.title')).toHaveText(title);
}

/** What the system clipboard holds, as text and as HTML. */
const clipboardOf = (app: ElectronApplication) =>
  app.evaluate(async ({ clipboard }) => {
    const items = await clipboard.read();
    const item = items.find((one) => one.types.includes('text/html'));
    const html = item ? await ((await item.getType('text/html')) as Blob).text() : '';
    return { text: await clipboard.readText(), html };
  });

const notice = (page: Page) => page.locator('.list__notice');

test('the menus: Edit → Copy as HTML (⇧⌘C), File → Export HTML…', async ({ app, page }) => {
  await expect(page.locator('.note-row').first()).toBeVisible();
  const items = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu()?.items.flatMap((menu) =>
      (menu.submenu?.items ?? []).map((item) => [menu.label, item.label, item.accelerator ?? null]),
    ),
  );
  expect(items).toEqual(
    expect.arrayContaining([
      ['Edit', 'Copy as HTML', 'CmdOrCtrl+Shift+C'],
      ['File', 'Export HTML…', null],
    ]),
  );
});

test('Copy as HTML, then paste into another note: the HTML out, the Markdown back', async ({
  app,
  page,
  vault,
}) => {
  await app.evaluate(({ clipboard }) => clipboard.writeText('before'));
  await open(page, 'Chapter');
  await clickMenu(app, 'Edit', 'Copy as HTML');
  await expect(notice(page)).toHaveText('Copied as HTML.');
  const copied = await clipboardOf(app);
  expect(copied.text).toBe(CHAPTER_HTML); // for a site's HTML box
  expect(copied.html).toContain(CHAPTER_HTML); // for its rich text box

  await open(page, 'Blank');
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+v');
  await expect
    .poll(() => readIn(vault, 'Blank.md'))
    .toBe('# The Scarf\n\n“Look,” he said.\n\n“No.”\n\n***\n\nShe *mended* it.');
});

test('Copy as HTML copies only what’s chosen, when something is', async ({ app, page }) => {
  await open(page, 'Chapter');
  await page.locator('.cm-line', { hasText: 'She mended it.' }).click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await clickMenu(app, 'Edit', 'Copy as HTML');
  await expect(notice(page)).toHaveText('Copied what’s chosen as HTML.');
  expect((await clipboardOf(app)).text).toBe('<p>She <em>mended</em> it.</p>');
});

test('pasted plain text that is really HTML becomes Markdown; code takes it as it is', async ({
  app,
  page,
  vault,
}) => {
  await app.evaluate(({ clipboard }) => clipboard.writeText('<p>One</p><p><em>Two</em></p>'));
  await open(page, 'Blank');
  await editorContent(page).click();
  await page.keyboard.press('ControlOrMeta+v');
  await expect.poll(() => readIn(vault, 'Blank.md')).toBe('One\n\n*Two*');

  await open(page, 'Code');
  await page.locator('.cm-line').nth(3).click(); // the code block's empty line
  await page.keyboard.press('ControlOrMeta+v');
  await expect
    .poll(() => readIn(vault, 'Code.md'))
    .toBe('Before.\n\n```\n<p>One</p><p><em>Two</em></p>\n```\n');
});

test('Export HTML saves where the dialog says, and nothing when it’s cancelled', async ({
  app,
  page,
}) => {
  const folder = mkdtempSync(join(tmpdir(), 'eien-export-'));
  const file = join(folder, 'The Scarf.html');
  try {
    // The system's save dialog, played: it offers the note's name, and the writer cancels, then saves.
    await app.evaluate(({ dialog }, file) => {
      const offered: string[] = [];
      (globalThis as { offered?: string[] }).offered = offered;
      let calls = 0;
      dialog.showSaveDialog = (async (_window: unknown, options: { defaultPath?: string }) => {
        offered.push(options.defaultPath ?? '');
        calls++;
        return calls === 1 ? { canceled: true } : { canceled: false, filePath: file };
      }) as typeof dialog.showSaveDialog;
    }, file);
    await open(page, 'Chapter');
    await clickMenu(app, 'File', 'Export HTML…');
    await expect
      .poll(() => app.evaluate(() => (globalThis as { offered?: string[] }).offered?.length))
      .toBe(1);
    expect(existsSync(file)).toBe(false);

    await clickMenu(app, 'File', 'Export HTML…');
    await expect(notice(page)).toHaveText('Saved as “The Scarf.html”.');
    expect(readFileSync(file, 'utf8')).toBe(`\uFEFF${CHAPTER_HTML}`); // marked as UTF-8 for a browser
    const offered = await app.evaluate(() => (globalThis as { offered?: string[] }).offered);
    expect(offered?.map((path) => path.split(/[\\/]/).pop())).toEqual([
      'Chapter.html',
      'Chapter.html',
    ]);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test('an empty note copies nothing, and says so', async ({ app, page }) => {
  await app.evaluate(({ clipboard }) => clipboard.writeText('kept'));
  await open(page, 'Blank');
  await clickMenu(app, 'Edit', 'Copy as HTML');
  await expect(notice(page)).toHaveText('Nothing to copy: the note has no words yet.');
  expect((await clipboardOf(app)).text).toBe('kept');
});

test('typed quotes curl by what’s around them; in code they stay straight', async ({
  page,
  vault,
}) => {
  await open(page, 'Blank');
  await editorContent(page).click();
  await page.keyboard.type('"Look," he said. \'Tis Sam\'s, from the \'90s. `"x"` *"Hi"*');
  await expect
    .poll(() => readIn(vault, 'Blank.md'))
    .toBe('“Look,” he said. ’Tis Sam’s, from the ’90s. `"x"` *“Hi”*');
  // ⌘Z takes the typing back, quotes and all.
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(() => readIn(vault, 'Blank.md')).not.toContain('“Look,”');
});

test('a vault set to straight quotes keeps them as typed', async ({ app, page, vault }) => {
  const settingsMenu = process.platform === 'darwin' ? 'Eien' : 'File';
  await open(page, 'Blank');
  await clickMenu(app, settingsMenu, 'Settings…');
  const dialog = page.getByRole('dialog', { name: 'Settings' });
  const tab = (name: string) =>
    dialog.getByRole('navigation').getByRole('button', { name, exact: true }).click();
  await tab('Writing'); // This vault's
  await dialog.getByRole('button', { name: 'Straight " "', exact: true }).click();
  await dialog.getByRole('button', { name: 'Rule alone', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect
    .poll(() => JSON.parse(readIn(vault, '.eien/config.json') || '{}'))
    .toEqual({ 'typography.quotes': 'straight', 'html.sceneBreak': 'rule' });

  await editorContent(page).click();
  await page.keyboard.type('"Plain," she said. Don\'t.');
  await expect.poll(() => readIn(vault, 'Blank.md')).toBe('"Plain," she said. Don\'t.');

  await open(page, 'Chapter');
  await clickMenu(app, 'Edit', 'Copy as HTML');
  await expect(notice(page)).toHaveText('Copied as HTML.');
  expect((await clipboardOf(app)).text).toBe(
    CHAPTER_HTML.replace('<p><br /></p><hr /><p><br /></p>', '<hr />').replaceAll(/[“”]/gu, '"'),
  );
});
