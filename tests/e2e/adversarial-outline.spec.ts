// Adversarial: phase 9c's outline cards on the real app — which book shows
// while the vault changes underneath, where the keyboard goes when the cards
// come and go, what the hidden page still answers to, and drags that end
// somewhere other than on a card. A comment on a test describes the defect
// it caught, as it was before the fix.

import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ElectronApplication, Page } from '@playwright/test';
import { ALONE, boxOf, clickMenu, editorContent, expect, fakeTrash, test } from './launch';

const BOOK = {
  'Loose.md': 'Not in a book.\n',
  'Research/Wool.md': 'Knitted wool runs.\n',
  'Scarf/.eien-folder.json': JSON.stringify({
    order: ['Tear.md', 'Mend.md', 'Fire.md', 'Ash.md', 'Snow.md'],
    book: {},
  }),
  'Scarf/Tear.md': 'The scarf caught on the gate.\n',
  'Scarf/Mend.md': 'She mended it.\n',
  'Scarf/Fire.md': 'By the fire, slowly.\n',
  'Scarf/Ash.md': 'Ash on the hearth.\n',
  'Scarf/Snow.md': 'Snow at the window.\n',
  'Draft/.eien-folder.json': '{"book":{}}',
};
test.use({ vaultFiles: BOOK });

const at = (vault: string | null, path: string) => join(vault ?? '', ...path.split('/'));
const exactly = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const board = (page: Page) => page.locator('.board');
const cards = (page: Page) => page.locator('.board .card');
const card = (page: Page, title: string) =>
  cards(page).filter({ has: page.locator('.card__title', { hasText: exactly(title) }) });
const titles = (page: Page) => page.locator('.board .card__title');
const folderRow = (page: Page, name: string) =>
  page
    .locator('.tree-row:not(.tree-row--note) .tree-row__name')
    .filter({ has: page.locator('.tree-row__label', { hasText: exactly(name) }) });
const row = (page: Page, title: string) =>
  page
    .locator('.note-row')
    .filter({ has: page.locator('.note-row__title', { hasText: exactly(title) }) });
const outline = (app: ElectronApplication) => clickMenu(app, 'View', 'Outline Cards');
const order = (vault: string | null, folder = 'Scarf') =>
  JSON.parse(readFileSync(at(vault, `${folder}/.eien-folder.json`), 'utf8')) as {
    order?: string[];
  };

/** Where the keyboard is: the focused element in brief, or "body" for nowhere. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) return 'body';
    const label = active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 40);
    return `${active.tagName.toLowerCase()}.${active.className}: ${label}`;
  });
/** How many cards the board lays in a row, as the window is now. */
const perRow = (page: Page) =>
  page
    .locator('.board .card')
    .evaluateAll(
      (all) =>
        all.filter((each) => (each as HTMLElement).offsetTop === (all[0] as HTMLElement).offsetTop)
          .length,
    );
/** Whether the element at `selector` covers the point (x, y). */
const under = (page: Page, selector: string, x: number, y: number) =>
  page.evaluate(
    ([selector, x, y]) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return !!box && box.left <= x && x <= box.right && box.top <= y && y <= box.bottom;
    },
    [selector, x, y] as const,
  );
/** Whether the keyboard is in `selector` (the editor's shadow root counts), on something seen. */
const focusIn = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const active = document.activeElement;
    return (
      active !== null &&
      active !== document.body &&
      active.checkVisibility() &&
      !!document.querySelector(selector)?.contains(active)
    );
  }, selector);

async function chooseBook(page: Page, name = 'Scarf'): Promise<void> {
  await folderRow(page, name).click();
  await expect(page.locator('.list__heading')).toHaveText(name);
}

async function showCards(app: ElectronApplication, page: Page): Promise<void> {
  await outline(app);
  await expect(titles(page)).toHaveCount(5);
}

test.describe('where the keyboard goes', () => {
  test('Enter on a card opens its chapter with the keyboard on the page', async ({ app, page }) => {
    // The card had the keyboard and is gone with the board: a writer who chose a chapter
    // with Enter and starts typing must be typing into it, not into nothing.
    await chooseBook(page);
    await showCards(app, page);
    await expect(cards(page).first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('.title')).toHaveText('Mend');
    await expect.poll(() => focused(page)).not.toBe('body');
    await expect.poll(() => focusIn(page, '.page')).toBe(true);
  });

  test('Go to Page while the cards show gives the keyboard to the cards', async ({ app, page }) => {
    // ⌘3 focuses the page pane; the cards are in its place, but the hidden editor is asked.
    await chooseBook(page);
    await row(page, 'Mend').click();
    await showCards(app, page);
    await clickMenu(app, 'View', 'Go to Sidebar');
    await expect.poll(() => focusIn(page, '.sidebar')).toBe(true);
    await clickMenu(app, 'View', 'Go to Page');
    await expect.poll(() => focused(page)).toMatch(/^button\.card/);
  });

  test('shutting the pane that has the keyboard, while the cards show, gives it to the cards', async ({
    app,
    page,
  }) => {
    // Spec §4: a pane shut with the keyboard in it gives the keyboard to the page.
    await chooseBook(page);
    await row(page, 'Mend').click();
    await showCards(app, page);
    await row(page, 'Fire').focus();
    await clickMenu(app, 'View', 'Toggle Note List');
    await expect(page.locator('.list')).toBeHidden();
    await expect.poll(() => focused(page)).toMatch(/^button\.card/);
  });

  test('Esc on the board’s Close button gives the page back', async ({ app, page }) => {
    // Spec §4: Esc gives the page back. Shift+Tab from a card lands on Close, where Esc is deaf.
    await chooseBook(page);
    await showCards(app, page);
    await page.keyboard.press('Shift+Tab');
    await expect(board(page).getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(board(page)).toBeHidden();
  });

  test('an empty book’s board takes the keyboard, so Esc gives the page back', async ({
    app,
    page,
  }) => {
    // With no card to focus, the keyboard stays in the editor the board hid: typing and Esc
    // go nowhere, and only the pointer can leave.
    await page.locator('.tree-row__label', { hasText: 'All Notes' }).first().click();
    await row(page, 'Loose').click();
    await chooseBook(page, 'Draft');
    await clickMenu(app, 'View', 'Go to Page');
    await expect(editorContent(page)).toBeFocused();
    await outline(app);
    await expect(page.locator('.board__empty')).toHaveText('No chapters yet.');
    await expect.poll(() => focused(page)).not.toBe('body');
    await page.keyboard.press('Escape');
    await expect(board(page)).toBeHidden();
  });

  test('↑ on the top row stays on its card', async ({ app, page }) => {
    // Up from the second card of the first row jumps sideways to the first card (and Down on
    // the last row sideways to the last): the keyboard lands on a card the writer didn't ask for.
    await chooseBook(page);
    await showCards(app, page);
    // A narrow window (a CI runner's) lays the cards one to a row: there, ↑ rightly goes up one.
    test.skip((await perRow(page)) < 2, 'one card to a row in this window');
    await page.keyboard.press('ArrowRight');
    await expect(card(page, 'Mend')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(card(page, 'Mend')).toBeFocused();
  });

  test('↓ and ↑ go by rows, Home and End to the ends', async ({ app, page, vault }) => {
    await chooseBook(page);
    await showCards(app, page);
    const names = ['Tear', 'Mend', 'Fire', 'Ash', 'Snow'];
    const row = await perRow(page); // two to a row on a wide window, one on a narrow one
    const down = Math.min(row, names.length - 1);
    await page.keyboard.press('ArrowDown');
    await expect(card(page, names[down] as string)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(card(page, 'Tear')).toBeFocused();
    await page.keyboard.press('End');
    await expect(card(page, 'Snow')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(card(page, 'Tear')).toBeFocused();
    await page.keyboard.press('Alt+ArrowLeft'); // the first can go no earlier
    await page.waitForTimeout(300);
    expect(order(vault).order).toEqual(['Tear.md', 'Mend.md', 'Fire.md', 'Ash.md', 'Snow.md']);
    await expect(titles(page)).toHaveText(['Tear', 'Mend', 'Fire', 'Ash', 'Snow']);
    await expect(card(page, 'Tear')).toBeFocused();
  });

  test('a chapter renamed elsewhere while its card has the keyboard: the keyboard stays on the cards', async ({
    app,
    page,
    vault,
  }) => {
    // Spec §4: a redraw gives the keyboard back to the control that had it, or to the row
    // now in a removed row's place. The card's path is gone, so the keyboard falls to nothing.
    await chooseBook(page);
    await showCards(app, page);
    await page.keyboard.press('ArrowRight');
    await expect(card(page, 'Mend')).toBeFocused();
    renameSync(at(vault, 'Scarf/Mend.md'), at(vault, 'Scarf/Mended.md')); // another device
    await expect(card(page, 'Mended')).toHaveCount(1);
    await expect.poll(() => focused(page)).toMatch(/^button\.card/);
  });

  test('the book renamed elsewhere: the page comes back, and has the keyboard', async ({
    app,
    page,
    vault,
  }) => {
    // The board closes when its book goes, but the keyboard was on a card and goes nowhere.
    await chooseBook(page);
    await row(page, 'Mend').click();
    await showCards(app, page);
    renameSync(at(vault, 'Scarf'), at(vault, 'Wool Scarf'));
    await expect(board(page)).toBeHidden();
    await expect.poll(() => focused(page)).not.toBe('body');
  });
});

test.describe('the page under the cards', () => {
  test('Format → Bold with the cards up leaves the hidden chapter alone', async ({
    app,
    page,
    vault,
  }) => {
    // The Format menu (⌘B, ⌘⇧8…) still writes into the editor the board hides: the chapter
    // changes, and is saved, where the writer can't see it.
    await chooseBook(page);
    await row(page, 'Mend').click();
    await showCards(app, page);
    await clickMenu(app, 'Format', 'Bold');
    await clickMenu(app, 'Format', 'Bulleted List');
    await page.waitForTimeout(1500); // past the autosave
    expect(readFileSync(at(vault, 'Scarf/Mend.md'), 'utf8')).toBe('She mended it.\n');
  });

  test('the open chapter renamed elsewhere doesn’t take the cards away', async ({
    app,
    page,
    vault,
  }) => {
    // No other note was opened; the book is still there. The board is closed anyway.
    await chooseBook(page);
    await row(page, 'Mend').click();
    await showCards(app, page);
    renameSync(at(vault, 'Scarf/Mend.md'), at(vault, 'Scarf/Mended.md'));
    await expect(row(page, 'Mended')).toHaveCount(1); // the vault read again
    await page.waitForTimeout(500);
    await expect(board(page)).toBeVisible();
    await expect(card(page, 'Mended')).toHaveCount(1);
  });

  test('a chapter sent to the trash from the list: its card goes, the board stays', async ({
    app,
    page,
  }) => {
    const trash = await fakeTrash(app);
    try {
      await chooseBook(page);
      await row(page, 'Mend').click();
      await showCards(app, page);
      await row(page, 'Fire').focus();
      await page.keyboard.press(
        process.platform === 'darwin' ? 'Meta+Backspace' : 'Control+Delete',
      );
      await expect(titles(page)).toHaveText(['Tear', 'Mend', 'Ash', 'Snow']);
      await expect(board(page)).toBeVisible();
      expect(existsSync(join(trash, 'Fire.md'))).toBe(true);
      await expect(page.locator('.board .card__number')).toHaveText(['i', 'ii', 'iii', 'iv']);
    } finally {
      rmSync(trash, { recursive: true, force: true });
    }
  });

  test('the open chapter’s book is shown, not the one chosen', async ({ app, page }) => {
    await chooseBook(page);
    await row(page, 'Mend').click();
    await chooseBook(page, 'Draft');
    await outline(app);
    await expect(board(page).locator('h2')).toHaveText('Scarf · outline');
    await expect(card(page, 'Mend')).toHaveAttribute('aria-current', 'true');
  });

  test('another note opened from the list gives the page back', async ({ app, page }) => {
    await chooseBook(page);
    await row(page, 'Mend').click();
    await showCards(app, page);
    await row(page, 'Fire').click();
    await expect(board(page)).toBeHidden();
    await expect(page.locator('.title')).toHaveText('Fire');
    await expect(page.locator('.sheet')).toBeVisible();
  });

  test('Esc shuts a menu opened over the cards, and leaves the cards', async ({ app, page }) => {
    await chooseBook(page);
    await showCards(app, page);
    await folderRow(page, 'Research').click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toBeHidden();
    await expect(board(page)).toBeVisible();
  });

  test('a book that stops being a book takes its cards with it', async ({ app, page, vault }) => {
    await chooseBook(page);
    await showCards(app, page);
    writeFileSync(at(vault, 'Scarf/.eien-folder.json'), '{"order":["Tear.md"]}');
    await expect(board(page)).toBeHidden();
  });
});

test.describe('a long chapter', () => {
  const long = Array.from({ length: 300 }, (_, i) => `Paragraph ${i + 1} of the long chapter.`);
  test.use({
    vaultFiles: {
      'Scarf/.eien-folder.json': '{"order":["Tear.md","Mend.md"],"book":{}}',
      'Scarf/Tear.md': `${long.join('\n\n')}\n`,
      'Scarf/Mend.md': 'She mended it.\n',
    },
  });

  test('closing the cards gives the chapter back where the writer was reading', async ({
    app,
    page,
  }) => {
    // The sheet and the board share one scroller: hiding the sheet clamps its scroll, so the
    // chapter comes back at its top, not where the writer left it (nothing moves unasked).
    await chooseBook(page);
    await row(page, 'Tear').click();
    await expect(editorContent(page)).toContainText('Paragraph 1 of');
    const scroller = page.locator('.page__scroll');
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight / 2;
    });
    await page.waitForTimeout(200);
    const before = await scroller.evaluate((element) => element.scrollTop);
    expect(before).toBeGreaterThan(1000);
    await outline(app);
    await expect(board(page)).toBeVisible();
    await clickMenu(app, 'View', 'Outline Cards');
    await expect(board(page)).toBeHidden();
    await page.waitForTimeout(300);
    const after = await scroller.evaluate((element) => element.scrollTop);
    expect(Math.abs(after - before)).toBeLessThan(50);
  });
});

// A vault's own root, marked as a book by its .eien-folder.json (another app, a hand edit).
test.describe('the vault itself as a book', () => {
  test.use({
    vaultFiles: {
      '.eien-folder.json': '{"order":["One.md","Two.md"],"book":{}}',
      'One.md': 'First.\n',
      'Two.md': 'Second.\n',
    },
  });

  test('its chapters show as cards, or a line says why not', async ({ app, page }) => {
    // The colophon counts the root as a book ("Book 2 / …"), but the board shows for a moment
    // and goes (the vault's list has no entry for the root itself), with no word why.
    await page.locator('.note-row', { hasText: 'One' }).first().click();
    await outline(app);
    await page.waitForTimeout(800);
    const shown = await board(page).isVisible();
    const news =
      (await page
        .locator('.list__notice')
        .textContent()
        .catch(() => '')) ?? '';
    expect(shown || news.length > 0).toBe(true);
  });
});

test.describe('hundreds of chapters, and long names', () => {
  const many: Record<string, string> = {};
  const names = Array.from({ length: 300 }, (_, i) => `Chapter ${String(i + 1).padStart(3, '0')}`);
  for (const name of names) many[`Saga/${name}.md`] = `${name} begins here, and goes on.\n`;
  many['Saga/.eien-folder.json'] = '{"book":{}}';
  many['Long/.eien-folder.json'] = '{"book":{}}';
  many['Long/the_scarf_caught_on_the_gate_and_she_mended_it_by_the_fire.md'] = 'Long.\n';
  many['Long/Short.md'] = 'Short.\n';
  test.use({ vaultFiles: many });

  test(
    'three hundred cards come up quickly and End reaches the last',
    ALONE,
    async ({ app, page }) => {
      await chooseBook(page, 'Saga');
      await expect(page.locator('.note-row')).toHaveCount(300);
      const start = Date.now();
      await outline(app);
      await expect(titles(page)).toHaveCount(300);
      expect(Date.now() - start).toBeLessThan(2000);
      await page.keyboard.press('End');
      await expect(card(page, 'Chapter 300')).toBeFocused();
      await expect(card(page, 'Chapter 300')).toBeInViewport();
    },
  );

  test('a long title stays inside its card', async ({ app, page }) => {
    // The card's title may not break inside a word (the page's title has overflow-wrap): a
    // name with no space, as notes brought from elsewhere often have, runs out over the next card.
    await chooseBook(page, 'Long');
    await outline(app);
    const long = card(page, 'the_scarf_caught_on_the_gate_and_she_mended_it_by_the_fire');
    await expect(long).toBeVisible();
    const box = await boxOf(long);
    const title = await boxOf(long.locator('.card__title'));
    expect(title.x + title.width).toBeLessThanOrEqual(box.x + box.width + 1);
  });
});

test.describe('dragging cards', () => {
  async function lift(page: Page, title: string) {
    await card(page, title).scrollIntoViewIfNeeded(); // one card to a row: it may be further down
    const from = await boxOf(card(page, title));
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height / 2 + 20, {
      steps: 4,
    });
    await expect(page.locator('.is-lifted')).toHaveCount(1);
    return from;
  }

  test(
    'dropped in the gap between two cards, a card goes between them',
    ALONE,
    async ({ app, page, vault }) => {
      // The gap is where a writer aims to put a card between two; there the marker vanishes and
      // the drop does nothing.
      await chooseBook(page);
      await showCards(app, page);
      test.skip((await perRow(page)) < 2, 'one card to a row in this window');
      const tear = await boxOf(card(page, 'Tear'));
      const mend = await boxOf(card(page, 'Mend'));
      expect(mend.y).toBe(tear.y);
      await lift(page, 'Snow');
      const gapX = (tear.x + tear.width + mend.x) / 2;
      await page.mouse.move(gapX, tear.y + tear.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(() => order(vault).order)
        .toEqual(['Tear.md', 'Snow.md', 'Mend.md', 'Fire.md', 'Ash.md']);
    },
  );

  test(
    '“after this card” and “before the next” mark the same place',
    ALONE,
    async ({ app, page }) => {
      // Both mean the same drop, but the marker stands inside the first card for one and in the
      // gap for the other: it jumps as the pointer crosses the gap.
      await chooseBook(page);
      await showCards(app, page);
      test.skip((await perRow(page)) < 2, 'one card to a row in this window');
      const tear = await boxOf(card(page, 'Tear'));
      const mend = await boxOf(card(page, 'Mend'));
      await lift(page, 'Snow');
      const markerX = () =>
        page.locator('.drop-marker--across').evaluate((m) => m.getBoundingClientRect().x);
      await page.mouse.move(tear.x + tear.width - 10, tear.y + tear.height / 2, { steps: 6 });
      await expect.poll(markerX).toBeGreaterThan(tear.x + tear.width / 2); // the marker on Tear's right
      const after = await markerX();
      await page.mouse.move(mend.x + 10, mend.y + mend.height / 2, { steps: 6 });
      await expect(page.locator('.drop-marker--across')).toBeVisible(); // before Mend now
      const before = await markerX();
      await page.keyboard.press('Escape');
      expect(Math.abs(after - before)).toBeLessThanOrEqual(2);
    },
  );

  test('a card lifted follows the pointer', ALONE, async ({ app, page }) => {
    await chooseBook(page);
    await showCards(app, page);
    await lift(page, 'Fire');
    await page.mouse.move(300, 300, { steps: 6 });
    await expect.poll(() => under(page, '.is-lifted', 300, 300)).toBe(true);
    await page.keyboard.press('Escape');
  });

  test(
    'Esc mid-drag, then let go over the card it started from: the chapter doesn’t open',
    ALONE,
    async ({ app, page }) => {
      // Holds: a writer who lifts a card, thinks better of it, presses Esc and lets go where
      // they started stays on the cards (the release isn't taken for a click).
      await chooseBook(page);
      await showCards(app, page);
      const fire = await lift(page, 'Fire');
      await page.mouse.move(300, 300, { steps: 6 });
      await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2, { steps: 6 });
      await page.keyboard.press('Escape');
      await expect(page.locator('.is-lifted')).toHaveCount(0);
      // A window out of sight holds its timers back; one of the page's own run first makes the
      // release come after whatever the Esc set going, as it does in a window in front.
      await page.evaluate(() => new Promise((done) => setTimeout(done, 50)));
      await page.mouse.up();
      await page.waitForTimeout(500);
      await expect(board(page)).toBeVisible();
      await expect(page.locator('.title')).not.toHaveText('Fire');
    },
  );

  test(
    'a redraw mid-drag keeps the lifted card with the pointer',
    ALONE,
    async ({ app, page, vault }) => {
      // The board's redraw (a sync from another device, news fading) takes the lifted card out
      // with the cards; it is put back in the document's body, outside the board, where no rule
      // positions it: the card the writer is carrying vanishes from under the pointer.
      await chooseBook(page);
      await showCards(app, page);
      await lift(page, 'Fire');
      writeFileSync(at(vault, 'Scarf/Tear.md'), 'The scarf caught on the gate, and tore.\n');
      await expect(card(page, 'Tear').locator('.card__words')).toHaveText('8 w');
      await page.mouse.move(320, 320, { steps: 6 });
      await expect(page.locator('.is-lifted')).toHaveCount(1);
      await page.waitForTimeout(200);
      const position = await page
        .locator('.is-lifted')
        .evaluate((element) => getComputedStyle(element).position);
      const following = await under(page, '.is-lifted', 320, 320);
      await page.keyboard.press('Escape');
      expect({ position, following }).toEqual({ position: 'fixed', following: true });
    },
  );

  test(
    'a card dragged onto a sidebar folder: lit as a target only if it goes there',
    ALONE,
    async ({ app, page, vault }) => {
      // The folder lights up as the list's drags light it, but the board's drop there is a no-op:
      // the writer is shown a move that never happens, and told nothing.
      await chooseBook(page);
      await showCards(app, page);
      await lift(page, 'Fire');
      const research = await boxOf(folderRow(page, 'Research'));
      await page.mouse.move(research.x + research.width / 2, research.y + research.height / 2, {
        steps: 8,
      });
      const lit = await folderRow(page, 'Research').evaluate((element) =>
        element.classList.contains('is-drop-target'),
      );
      await page.mouse.up();
      await page.waitForTimeout(800);
      const moved = existsSync(at(vault, 'Research/Fire.md'));
      expect({ lit, moved }).not.toEqual({ lit: true, moved: false });
    },
  );

  test(
    'a card nudged onto its own place changes nothing on disk',
    ALONE,
    async ({ app, page, vault }) => {
      // A wobble on a card (past the 5 px a drag needs, still over itself) writes the book's
      // order out again; a book never put in order is given one, so new chapters no longer
      // sort in by name.
      writeFileSync(at(vault, 'Scarf/.eien-folder.json'), '{"book":{}}');
      await chooseBook(page);
      await showCards(app, page);
      const before = readFileSync(at(vault, 'Scarf/.eien-folder.json'), 'utf8');
      const first = await boxOf(cards(page).first());
      await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
      await page.mouse.down();
      await page.mouse.move(first.x + first.width / 2 + 30, first.y + first.height / 2, {
        steps: 6,
      });
      await page.mouse.up();
      await page.waitForTimeout(1000);
      await expect(board(page)).toBeVisible(); // the click after a drag isn't the writer's
      expect(readFileSync(at(vault, 'Scarf/.eien-folder.json'), 'utf8')).toBe(before);
    },
  );

  test(
    'Esc mid-drag puts the card back, and the cards stay',
    ALONE,
    async ({ app, page, vault }) => {
      await chooseBook(page);
      await showCards(app, page);
      await lift(page, 'Fire');
      const tear = await boxOf(card(page, 'Tear'));
      await page.mouse.move(tear.x + 10, tear.y + tear.height / 2, { steps: 6 });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      await expect(page.locator('.is-lifted')).toHaveCount(0);
      await expect(board(page)).toBeVisible();
      await page.waitForTimeout(500);
      expect(order(vault).order).toEqual(['Tear.md', 'Mend.md', 'Fire.md', 'Ash.md', 'Snow.md']);
    },
  );

  test(
    'across rows: dropped on the next row’s first card, it goes before it',
    ALONE,
    async ({ app, page, vault }) => {
      await chooseBook(page);
      await showCards(app, page);
      const fire = await boxOf(card(page, 'Fire'));
      await lift(page, 'Tear');
      await page.mouse.move(fire.x + 10, fire.y + fire.height / 2, { steps: 8 });
      await page.mouse.up();
      await expect
        .poll(() => order(vault).order)
        .toEqual(['Mend.md', 'Tear.md', 'Fire.md', 'Ash.md', 'Snow.md']);
    },
  );
});

// The design's rules for the interface code (docs/design/README.md), read from the styles
// the window has loaded.
test.describe('the cards’ looks', () => {
  /** Every style rule the window has, inside @media and @container too: selector and text. */
  const rules = (page: Page) =>
    page.evaluate(() => {
      const out: { selector: string; text: string }[] = [];
      const walk = (list: CSSRuleList) => {
        for (const rule of list) {
          if (rule instanceof CSSStyleRule) {
            out.push({ selector: rule.selectorText, text: rule.style.cssText });
          }
          if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules);
        }
      };
      for (const sheet of document.styleSheets) walk(sheet.cssRules);
      return out;
    });

  test('a card casts no shadow, and is ringed in ink when it has the keyboard', async ({
    app,
    page,
  }) => {
    await chooseBook(page);
    await showCards(app, page);
    const first = cards(page).first();
    await expect(first).toBeFocused();
    expect(await first.evaluate((card) => getComputedStyle(card).boxShadow)).toBe('none');
    const all = await rules(page);
    const ring = all.find((rule) => rule.selector === '.card:focus-visible');
    expect(ring?.text).toContain('var(--eien-focus)');
    for (const rule of all.filter((each) => /\.card\b|\.board/u.test(each.selector))) {
      if (/box-shadow/u.test(rule.text)) expect(rule.selector).toContain('.is-lifted');
    }
  });

  test('a card shows when it’s pressed, as every control does', async ({ app, page }) => {
    // Design rule 6: hover, pressed, focus. The list's rows and the tree's have :active; a
    // card has hover and focus only.
    await chooseBook(page);
    await showCards(app, page);
    const all = await rules(page);
    expect(all.some((rule) => /\.note-row:active/u.test(rule.selector))).toBe(true);
    expect(all.some((rule) => /\.card:active/u.test(rule.selector))).toBe(true);
  });

  test(
    'a card being dragged is raised paper, as a dragged row is',
    ALONE,
    async ({ app, page }) => {
      // docs/design: raised paper is for "a row being dragged" (the list's lifted row has it);
      // the lifted card keeps the plain paper it lay on the blotter with.
      await chooseBook(page);
      await showCards(app, page);
      const from = await boxOf(card(page, 'Fire'));
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2 + 30, from.y + from.height / 2 + 30, {
        steps: 4,
      });
      const lifted = page.locator('.is-lifted');
      await expect(lifted).toHaveCount(1);
      const [ground, raised] = await lifted.evaluate((element) => {
        const probe = document.body.appendChild(document.createElement('div'));
        probe.style.background = 'var(--eien-paper-raised)';
        const raised = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return [getComputedStyle(element).backgroundColor, raised];
      });
      await page.keyboard.press('Escape');
      await page.mouse.up();
      expect(ground).toBe(raised);
    },
  );
});
