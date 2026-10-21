// Phase 9b on the real app (spec §4): the colophon counts today's words —
// the writer's own, net, on this device, kept across a restart — the open
// note's book against its goal, and a sprint's time and words; a seal or a
// change from another device isn't writing.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { clickMenu, closeApp, editorContent, expect, launchApp, test } from './launch';

test.use({
  vaultFiles: {
    'Loose.md': 'One two three.\n',
    'Scarf/.eien-folder.json': '{"order":["Tear.md","Mend.md"],"book":{"goal":40000}}',
    'Scarf/Tear.md': 'The scarf caught on the gate.\n',
    'Scarf/Mend.md': 'She mended it by the fire, slowly.\n',
  },
});

const today = (page: Page) => page.locator('.colophon__today');
const book = (page: Page) => page.locator('.colophon__book');
const sprint = (page: Page) => page.locator('.colophon__sprint');
const words = (page: Page) => page.locator('.colophon__words');

async function open(page: Page, title: string): Promise<void> {
  await page.locator('.note-row', { hasText: title }).click();
  await expect(page.locator('.title')).toHaveText(title);
}

async function typeAtEnd(page: Page, text: string): Promise<void> {
  await editorContent(page).click({ position: { x: 4, y: 4 } });
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.type(text);
}

test('today counts what the writer writes, net; a seal or another device’s change doesn’t count', async ({
  app,
  page,
  vault,
}) => {
  await open(page, 'Loose');
  await expect(today(page)).toHaveText('Today 0');
  await typeAtEnd(page, ' Four five six.');
  await expect(words(page)).toHaveText('6 words');
  await expect(today(page)).toHaveText('Today +3');

  // Cutting counts against it.
  for (let i = 0; i < ' six.'.length; i++) await page.keyboard.press('Backspace');
  await expect(today(page)).toHaveText('Today +2');

  // A seal adds the note's id: no one's words. The line reads "Not sealed yet" before it, so
  // the wait is for what the seal says once it's done.
  await clickMenu(app, 'File', 'Seal');
  await expect(page.locator('.seal-line')).toHaveText(/^Sealed /u);
  await expect(today(page)).toHaveText('Today +2');

  // Another device's words arrive once the seal's own write is on disk (its id in the note):
  // shown, not counted as written here. Before it, both would have changed, and the page's
  // words would rightly go to a conflict copy.
  await expect
    .poll(() => readFileSync(join(vault ?? '', 'Loose.md'), 'utf8'))
    .toMatch(/^---\nid: \w+\n---\n[\s\S]*Four five/u);
  const text = readFileSync(join(vault ?? '', 'Loose.md'), 'utf8');
  writeFileSync(join(vault ?? '', 'Loose.md'), `${text.trimEnd()} Seven eight nine ten.\n`);
  await expect(words(page)).toHaveText('9 words');
  await expect(today(page)).toHaveText('Today +2');
});

test('today’s words are kept across a restart, on this device', async ({
  app,
  page,
  userData,
  vault,
}) => {
  await open(page, 'Loose');
  await typeAtEnd(page, ' Four five.');
  await expect(today(page)).toHaveText('Today +2');
  await closeApp(app);
  const again = await launchApp(userData, vault);
  try {
    const next = await again.firstWindow();
    await expect(next.locator('.colophon__today')).toHaveText('Today +2');
  } finally {
    await closeApp(again);
  }
});

test('a book’s chapter shows the book’s words against its goal, set from the folder’s menu', async ({
  page,
  vault,
}) => {
  await page.locator('.tree-row__label', { hasText: 'Scarf' }).click();
  await open(page, 'Tear');
  await expect(book(page)).toHaveText('Book 13 / 40,000'); // 6 words and 7
  await typeAtEnd(page, ' Again.');
  await expect(book(page)).toHaveText('Book 14 / 40,000'); // the open chapter counted live

  // Word goal… asks in a small field; Enter sets it.
  await page.locator('.tree-row__label', { hasText: 'Scarf' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Word goal…' }).click();
  const field = page.getByRole('textbox', { name: 'Word goal for Scarf' });
  await expect(field).toHaveValue('40,000');
  await field.fill('90 000');
  await field.press('Enter');
  await expect(book(page)).toHaveText('Book 14 / 90,000');
  expect(JSON.parse(readFileSync(join(vault ?? '', 'Scarf/.eien-folder.json'), 'utf8'))).toEqual({
    order: ['Tear.md', 'Mend.md'],
    book: { goal: 90000 },
  });

  // A goal that isn't a number is refused, and the field stays; empty takes the goal away.
  await page.locator('.tree-row__label', { hasText: 'Scarf' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Word goal…' }).click();
  await field.fill('lots');
  await field.press('Enter');
  await expect(field).toHaveAttribute('aria-invalid', 'true');
  await field.fill('');
  await field.press('Enter');
  await expect(book(page)).toHaveText('Book 14');

  // A note outside the book shows no book.
  await page.locator('.tree-row__label', { hasText: 'All Notes' }).click();
  await open(page, 'Loose');
  await expect(book(page)).toBeHidden();
});

test('a sprint counts down, counts the words gained, and stops', async ({ app, page }) => {
  await open(page, 'Loose');
  await clickMenu(app, 'View', 'Start Sprint');
  await app.evaluate(({ BrowserWindow, Menu }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const view = Menu.getApplicationMenu()?.items.find((menu) => menu.label === 'View');
    const start = view?.submenu?.items.find((item) => item.label === 'Start Sprint');
    start?.submenu?.items
      .find((item) => item.label === '10 Minutes')
      ?.click(undefined, window, window?.webContents);
  });
  await expect(sprint(page)).toHaveText(/^Sprint (10:00|9:5\d) 0$/);
  await typeAtEnd(page, ' Four five.');
  await expect(sprint(page)).toHaveText(/^Sprint 9:5\d \+2$/);
  await clickMenu(app, 'View', 'Stop Sprint');
  await expect(sprint(page)).toBeHidden();
});

test('a sprint ends quietly: the colophon says so, and one line of news', async ({ page }) => {
  await open(page, 'Loose');
  // A sprint two seconds from its end, as a restart would find it.
  await page.evaluate(() =>
    localStorage.setItem(
      'eien.sprint',
      JSON.stringify({ ends: Date.now() + 2_000, minutes: 10, words: 41 }),
    ),
  );
  await page.reload();
  await expect(page.locator('.colophon__sprint')).toHaveText(/^Sprint 0:0[12] \+41$/);
  await expect(page.locator('.colophon__sprint')).toHaveText('Sprint done +41', { timeout: 5_000 });
  await expect(page.locator('.list__notice')).toHaveText('The sprint is over: +41 words.');
});
