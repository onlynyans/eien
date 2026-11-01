// A link's tools in Live (backlog #38, spec §4 Links), each of the three ways
// the "Link editing" setting chooses, on the real app: a hover and the caret
// show it; its words and where it goes are edited; ⌘Z puts them back; Open
// and ⌥↩ follow it; ⌥F10 takes the keyboard to its tools and Esc brings it
// back; ⌘-click still follows and a plain click still places the caret.

import { join } from 'node:path';
import type { ElectronApplication, Locator, Page } from '@playwright/test';
import { editorContent, expect, readQuietly, test } from './launch';

const PLAN = [
  'Chapters: [[Below the Gate|chapter iii]] then the wiki.',
  '',
  'Read [AO3](https://archiveofourown.org/works/1) for the tags.',
  '',
  'Last line.',
  '',
].join('\n');

const VAULT = {
  'Plan.md': PLAN,
  'Fic/Below the Gate.md': 'The water came up through the stones first.\n',
};

const settings = (style: string) => ({ settings: { 'editor.links': style } });

/** Record what the app would open in the browser, instead of opening it. */
async function catchOpened(app: ElectronApplication): Promise<() => Promise<string[]>> {
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    Object.assign(globalThis, { opened });
    shell.openExternal = async (url) => void opened.push(url);
  });
  return () => app.evaluate(() => (globalThis as unknown as { opened: string[] }).opened);
}

async function openPlan(page: Page): Promise<void> {
  await page.locator('.note-row', { hasText: 'Plan' }).click();
  await expect(page.locator('.title')).toHaveText('Plan');
  await lastLine(page);
}

/** The caret at the note's end, away from both links: by key, as a card may lie over the lines under a link. */
async function lastLine(page: Page): Promise<void> {
  await editorContent(page).focus();
  await page.keyboard.press('ControlOrMeta+End');
}

const link = (page: Page, words: string) => page.locator('.eien-link', { hasText: words });
const file = (vault: string | null) => () => readQuietly(join(vault ?? '', 'Plan.md'));

/** Rest the pointer on `target` till `shown` is there: a hover can land before the page is still. */
async function hoverTill(page: Page, target: Locator, shown: Locator): Promise<void> {
  await expect(async () => {
    await page.mouse.move(0, 0);
    await target.hover();
    await expect(shown).toBeVisible({ timeout: 1500 });
  }).toPass();
}

/** A link's tools in sight, whichever way they're shown. */
const SHOWN = '.link-card:not([hidden]), .link-bar:not([hidden]), .eien-link-open';

/** ⌘-click follows; a plain click places the caret and follows nothing. */
async function clicksAsBefore(page: Page, opened: () => Promise<string[]>): Promise<void> {
  const before = (await opened()).length;
  await lastLine(page);
  await link(page, 'AO3').click({ modifiers: ['ControlOrMeta'] });
  await expect.poll(async () => (await opened()).length).toBe(before + 1);
  await lastLine(page);
  await link(page, 'AO3').click();
  // Nothing more opens: read once the click's caret has landed in the link and its tools came.
  await expect(page.locator(SHOWN)).toHaveCount(1);
  expect(await opened()).toHaveLength(before + 1);
}

test.use({ vaultFiles: VAULT });

test.describe('the card', () => {
  test.use({ deviceFile: settings('card') });

  test('comes on a hover and with the caret, and says which note it opens', async ({ page }) => {
    await openPlan(page);
    const card = page.getByRole('group', { name: 'Link to Below the Gate' });
    await hoverTill(page, link(page, 'chapter iii'), card);
    await expect(card).toContainText('Fic');
    await expect(card).toContainText('The water came up');
    await page.mouse.move(0, 0);
    await expect(card).toBeHidden();

    await link(page, 'AO3').click();
    const web = page.getByRole('group', { name: 'Link to archiveofourown.org/works/1' });
    await expect(web).toBeVisible();
    await lastLine(page);
    await expect(web).toBeHidden();
  });

  test('edits the words and where it goes, one ⌘Z puts both back; Open and the keys', async ({
    app,
    page,
    vault,
  }) => {
    const opened = await catchOpened(app);
    await openPlan(page);
    await link(page, 'AO3').click();
    await page.keyboard.press('ControlOrMeta+k');
    const words = page.getByRole('textbox', { name: 'Words' });
    const goes = page.getByRole('textbox', { name: 'Goes to' });
    await expect(words).toBeFocused();
    await words.fill('the archive');
    await goes.fill('https://ao3.org/works/2');
    await goes.press('Enter');
    await expect.poll(file(vault)).toContain('Read [the archive](https://ao3.org/works/2) for');
    await expect(editorContent(page)).toBeFocused();

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(file(vault)).toBe(PLAN);

    // Open follows the link; ⌥↩ too.
    const card = page.getByRole('group', { name: /^Link to archiveofourown/ });
    await card.getByRole('button', { name: /^Open/ }).click();
    await expect.poll(opened).toEqual(['https://archiveofourown.org/works/1']);
    await page.keyboard.press('Alt+Enter');
    await expect.poll(async () => (await opened()).length).toBe(2);

    // ⌥F10 to its tools, Esc back to the words.
    await page.keyboard.press('Alt+F10');
    await expect(card.getByRole('button', { name: /^Open/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(editorContent(page)).toBeFocused();

    await clicksAsBefore(page, opened);
  });

  test('a wiki link’s Open goes to its note', async ({ page }) => {
    await openPlan(page);
    await link(page, 'chapter iii').click();
    await page
      .getByRole('group', { name: 'Link to Below the Gate' })
      .getByRole('button', { name: 'Open Below the Gate' })
      .click();
    await expect(page.locator('.title')).toHaveText('Below the Gate');
  });
});

test.describe('in place', () => {
  test.use({ deviceFile: settings('inline') });

  test('opens the link’s Markdown with the caret; the colophon says where it goes', async ({
    app,
    page,
    vault,
  }) => {
    const opened = await catchOpened(app);
    await openPlan(page);
    const said = page.locator('.colophon__said');
    await hoverTill(page, link(page, 'AO3'), said.filter({ hasText: /archiveofourown\.org/ }));

    await link(page, 'AO3').click();
    const open = page.getByRole('button', { name: 'Open https://archiveofourown.org/works/1' });
    await expect(open).toBeVisible();
    await expect(page.locator('.eien-link-address')).toHaveText(
      'https://archiveofourown.org/works/1',
    );

    // The words, typed where they are; ⌘K chooses where it goes, to type over.
    await page.keyboard.type('!');
    await page.keyboard.press('ControlOrMeta+k');
    await page.keyboard.type('https://ao3.org');
    await expect.poll(file(vault)).toMatch(/\[[^\]]*![^\]]*\]\(https:\/\/ao3\.org\)/);
    // Each is a step of its own: ⌘Z puts back where it went, then the words.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(file(vault)).toMatch(/\]\(https:\/\/archiveofourown\.org\/works\/1\)/);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(file(vault)).toBe(PLAN);

    // ⌥F10 to ↗, which opens it; Esc back to the words.
    await link(page, 'AO3').click();
    await page.keyboard.press('Alt+F10');
    await expect(open).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(opened).toEqual(['https://archiveofourown.org/works/1']);
    await page.keyboard.press('Escape');
    await expect(editorContent(page)).toBeFocused();

    await clicksAsBefore(page, opened);
  });
});

test.describe('the bar', () => {
  test.use({ deviceFile: settings('bar') });

  test('a tooltip on a hover; a bar with the caret, its field edits where it goes', async ({
    app,
    page,
    vault,
  }) => {
    const opened = await catchOpened(app);
    await openPlan(page);
    const tip = page.locator('.link-tip');
    await hoverTill(page, link(page, 'AO3'), tip);
    await expect(tip).toContainText('→ archiveofourown.org/works/1');
    await page.mouse.move(0, 0);
    await expect(tip).toBeHidden();

    await link(page, 'AO3').click();
    const bar = page.getByRole('toolbar', { name: 'Link to archiveofourown.org/works/1' });
    await expect(bar).toBeVisible();

    // The words, typed on the page: the bar steps aside, and comes back when the caret moves.
    await page.keyboard.type('!');
    await expect(page.locator('.link-bar:not([hidden])')).toHaveCount(0);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.link-bar:not([hidden])')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+k');
    const goes = page.getByRole('textbox', { name: /^Goes to/ });
    await expect(goes).toBeFocused();
    await goes.fill('https://ao3.org');
    await goes.press('Enter');
    await expect.poll(file(vault)).toMatch(/\[[^\]]*![^\]]*\]\(https:\/\/ao3\.org\)/);
    await expect(editorContent(page)).toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(file(vault)).toMatch(/\]\(https:\/\/archiveofourown\.org\/works\/1\)/);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(file(vault)).toBe(PLAN);

    const now = page.locator('.link-bar:not([hidden])');
    await now.getByRole('button', { name: /^Open/ }).click();
    await expect.poll(opened).toEqual(['https://archiveofourown.org/works/1']);
    await page.keyboard.press('Alt+F10');
    await expect(now.getByRole('button', { name: /^Open/ })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(editorContent(page)).toBeFocused();

    await clicksAsBefore(page, opened);
  });
});

test.describe('the setting', () => {
  test.use({ deviceFile: settings('card') });

  test('swaps the way a link shows, live', async ({ page }) => {
    await openPlan(page);
    await link(page, 'AO3').click();
    await expect(page.getByRole('group', { name: /^Link to archiveofourown/ })).toBeVisible();
    // As the writer does it: Settings → Writing → Editor → Link editing.
    await page.getByRole('button', { name: 'Settings' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await dialog
      .getByRole('navigation')
      .getByRole('button', { name: 'Editor', exact: true })
      .click();
    const bar = dialog
      .getByRole('group', { name: 'Link editing', exact: true })
      .getByRole('button', { name: 'Bar', exact: true });
    await bar.click();
    await expect(bar).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await link(page, 'AO3').click();
    await expect(page.getByRole('toolbar', { name: /^Link to archiveofourown/ })).toBeVisible();
    await expect(page.getByRole('group', { name: /^Link to archiveofourown/ })).toBeHidden();
  });
});
