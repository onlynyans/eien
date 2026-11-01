// Speed budgets (docs/backlog.md, the performance foundation): what a writer
// does with thousands of notes, held to a time. A long task is the window
// unable to answer: over 200 ms is a stall a writer feels. Long lists draw
// only the rows in sight (src/ui/shell/windowed-rows.ts), and the keyboard
// still reaches every row. Each runs alone (ALONE), so it measures Eien.

import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { handEpub, nav, opf, XHTML, page as xhtml } from '../support/epub-parts';
import { longBook } from '../support/long-book';
import { ALONE, clickMenu, expect, readQuietly, test, type VaultFiles } from './launch';

/** The budget for anything a writer does: no task holds the window longer than this. */
const STALL = 200;

const MANY: VaultFiles = Object.fromEntries(
  Array.from({ length: 3000 }, (_, i) => [`Note ${i}.md`, `Words of note ${i}. #many\n`]),
);
/** A book in its own order, long enough to be drawn by the rows in sight. */
const BIG = Array.from({ length: 300 }, (_, i) => `Chapter ${String(i).padStart(3, '0')}.md`);
const BOOK: VaultFiles = {
  ...Object.fromEntries(BIG.map((name) => [`Big/${name}`, `${name}\n`])),
  'Big/.eien-folder.json': JSON.stringify({ order: BIG, book: {} }),
};

type Long = { long: { start: number; ms: number }[]; since: number; observer: PerformanceObserver };

/**
 * Start counting long tasks; `longest()` is the longest since the last `mark()`.
 * Chromium reports a task a little after it ends, so `longest()` waits a
 * moment, then takes what's waiting (`takeRecords`) rather than missing it.
 */
async function stalls(page: Page) {
  if (process.env.SLOW)
    await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', {
      rate: Number(process.env.SLOW),
    });
  await page.evaluate(() => {
    const w = window as unknown as Long;
    const keep = (entries: PerformanceEntryList) => {
      for (const entry of entries)
        w.long.push({ start: entry.startTime, ms: Math.round(entry.duration) });
    };
    w.long = [];
    w.since = 0;
    w.observer = new PerformanceObserver((list) => keep(list.getEntries()));
    w.observer.observe({ type: 'longtask' });
  });
  return {
    mark: () =>
      page.evaluate(() => {
        (window as unknown as Long).since = performance.now();
      }),
    longest: async () => {
      const ms = await page.evaluate(async () => {
        const w = window as unknown as Long;
        await new Promise((done) => setTimeout(done, 150));
        for (const entry of w.observer.takeRecords())
          w.long.push({ start: entry.startTime, ms: Math.round(entry.duration) });
        return Math.max(
          0,
          ...w.long.filter((task) => task.start >= w.since).map((task) => task.ms),
        );
      });
      if (process.env.SLOW !== undefined || process.env.BUDGETS)
        console.log(`longest task: ${ms} ms · ${test.info().title}`);
      return ms;
    },
  };
}

// Selectors the window answers itself: a locator filtering thousands of rows by text would be the long task.
const library = (page: Page, name: string) =>
  page.locator(`.tree-row__name[data-key="${name === 'All Notes' ? 'all' : name}"]`);
const folderRow = (page: Page, path: string) =>
  page.locator(`.tree-row__name[data-key="folder:${path}"]`);
const control = (page: Page, command: string) =>
  page.locator(`[data-command="${command}"]:visible`).first();
const focusedPos = (page: Page) =>
  page.evaluate(
    () => document.activeElement?.closest('[aria-posinset]')?.getAttribute('aria-posinset') ?? null,
  );

async function twoPanes(page: Page): Promise<void> {
  await page.locator('.sidebar__foot [data-command="panes"][aria-pressed="false"]').click();
  await expect(page.locator('.shell')).toHaveAttribute('data-panes', 'two');
}

test.describe('three thousand notes', () => {
  test.use({ vaultFiles: { ...MANY, 'Chapter.md': 'The first line.\n' } });

  test(
    'the list draws the rows in sight, and the keyboard reaches every one',
    ALONE,
    async ({ page }) => {
      test.setTimeout(90_000);
      await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
      const time = await stalls(page);
      await time.mark();
      await library(page, 'All Notes').click();
      await expect(page.locator('.rows > li[aria-setsize="3001"]').first()).toBeVisible();
      expect(await page.locator('.rows .note-row').count()).toBeLessThan(200);
      await page.locator('.rows .note-row').first().focus();
      await page.keyboard.press('End');
      await expect.poll(() => focusedPos(page)).toBe('3001');
      await page.keyboard.press('Home');
      await expect.poll(() => focusedPos(page)).toBe('1');
      await page.keyboard.press('PageDown');
      await page.keyboard.press('ArrowDown');
      expect(Number(await focusedPos(page))).toBeGreaterThan(5);
      expect(await time.longest()).toBeLessThan(STALL);
    },
  );

  test(
    'two panes: the keyboard goes past the rows drawn, and keeps its row through a sync',
    ALONE,
    async ({ page, vault }) => {
      test.setTimeout(90_000);
      await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
      await twoPanes(page);
      await library(page, 'All Notes').click();
      const all = page.locator('.tree-group .tree-window').first();
      await expect(all.locator('li[aria-setsize="3001"]').first()).toBeVisible();
      await all.locator('.tree-row__name').first().focus();
      for (let i = 0; i < 4; i++) await page.keyboard.press('PageDown');
      const at = Number(await focusedPos(page));
      expect(at).toBeGreaterThan(40);
      const key = await page.evaluate(() => (document.activeElement as HTMLElement).dataset.key);
      // Another device's note arrives: the tree draws again, and the keyboard stays on its row.
      writeFileSync(join(vault ?? '', 'From the phone.md'), 'synced\n');
      await expect(page.locator('.sidebar__count')).toHaveText('3,002 notes', { timeout: 30_000 });
      await expect
        .poll(() => page.evaluate(() => (document.activeElement as HTMLElement).dataset.key))
        .toBe(key);
    },
  );

  test(
    'split: opening beside, switching notes and pages and dragging the divider never stall',
    ALONE,
    async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 1600, height: 900 });
      await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
      await library(page, 'All Notes').click();
      const rows = page.locator('.rows .note-row');
      await rows.nth(0).click();
      const time = await stalls(page);
      await time.mark();
      await rows.nth(1).click({ modifiers: ['ControlOrMeta'] });
      await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
      for (let i = 2; i < 6; i++) await rows.nth(i).click(); // notes on the active page
      await page.locator('.page__pages > .page__leaf:not([data-active]) .sheet').click();
      const divider = page.getByRole('separator', { name: 'Between the two pages' });
      const at = await divider.boundingBox();
      if (!at) throw new Error('no divider');
      await page.mouse.move(at.x + at.width / 2, at.y + 60);
      await page.mouse.down();
      await page.mouse.move(at.x + 160, at.y + 60, { steps: 8 });
      await page.mouse.up();
      expect(await time.longest()).toBeLessThan(STALL);
    },
  );

  test('switching layouts never stalls', ALONE, async ({ page }) => {
    test.setTimeout(90_000);
    await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
    await twoPanes(page);
    await library(page, 'All Notes').click();
    await expect(page.locator('.tree-window')).toHaveCount(2);
    const time = await stalls(page);
    for (const layout of ['slip', 'runhead', 'band'] as const) {
      await control(page, 'settings').click();
      const dialog = page.getByRole('dialog', { name: 'Settings' });
      await expect(dialog).toBeVisible();
      await time.mark();
      await dialog
        .getByRole('group', { name: 'Layout' })
        .locator(`[data-value="${layout}"]`)
        .click();
      await expect(page.locator('html')).toHaveAttribute('data-layout', layout);
      await page.waitForTimeout(300);
      expect(await time.longest(), layout).toBeLessThan(STALL);
      await page.keyboard.press('Escape');
    }
  });

  test(
    'a hundred notes from another device at once never stall',
    ALONE,
    async ({ page, vault }) => {
      test.setTimeout(90_000);
      await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
      await twoPanes(page);
      await library(page, 'All Notes').click();
      await expect(page.locator('.tree-window')).toHaveCount(2);
      const time = await stalls(page);
      await time.mark();
      for (let i = 0; i < 100; i++)
        writeFileSync(join(vault ?? '', `Synced ${i}.md`), `From the phone, ${i}.\n`);
      await expect(page.locator('.sidebar__count')).toHaveText('3,101 notes', { timeout: 30_000 });
      await page.waitForTimeout(500);
      expect(await time.longest()).toBeLessThan(STALL);
    },
  );

  test(
    'a tag kept out of three thousand from the sidebar never stalls (#32)',
    ALONE,
    async ({ page }) => {
      test.setTimeout(90_000);
      await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
      await library(page, 'All Notes').click();
      await expect(page.locator('.rows > li[aria-setsize="3001"]').first()).toBeVisible();
      const time = await stalls(page);
      await time.mark();
      await page.locator('.tree-row__name[data-key="tag:many"]').click({ modifiers: ['Alt'] });
      await expect(page.locator('.list__count')).toHaveText('1 of 3,001 notes');
      await page.locator('.tree-row__name[data-key="tag:many"]').click({ modifiers: ['Alt'] });
      await expect(page.locator('.list__count')).toHaveText('3,001 notes');
      expect(await time.longest()).toBeLessThan(STALL);
    },
  );

  test('a note renamed among three thousand never stalls', ALONE, async ({ page, vault }) => {
    test.setTimeout(90_000);
    await expect(page.locator('.note-row').first()).toBeVisible({ timeout: 30_000 });
    await library(page, 'All Notes').click();
    await expect(page.locator('.rows > li[aria-setsize="3001"]').first()).toBeVisible();
    // Written again (from another device, say): the newest, so first of the three thousand.
    writeFileSync(join(vault ?? '', 'Chapter.md'), 'The first line.\n');
    const chapter = page.locator('.rows .note-row[data-path="Chapter.md"]');
    await expect(page.locator('.rows .note-row').first()).toHaveAttribute(
      'data-path',
      'Chapter.md',
      { timeout: 30_000 },
    );
    await chapter.focus();
    const time = await stalls(page);
    await time.mark();
    await page.keyboard.press('F2');
    await expect(page.locator('.name-field__input')).toBeFocused();
    await page.keyboard.type('The Gate Holds');
    await page.keyboard.press('Enter');
    await expect.poll(() => readdirSync(vault ?? '')).toContain('The Gate Holds.md');
    expect(readdirSync(vault ?? '')).not.toContain('Chapter.md');
    await page.waitForTimeout(300);
    expect(await time.longest()).toBeLessThan(STALL);
  });
});

test.describe('a long book in its own order', () => {
  test.use({ vaultFiles: BOOK });

  test(
    'a chapter dragged at the far end of a long order lands where it was let go',
    ALONE,
    async ({ page, vault }) => {
      test.setTimeout(90_000);
      await folderRow(page, 'Big').click();
      await expect(page.locator('.rows > li[aria-setsize="300"]').first()).toBeVisible({
        timeout: 30_000,
      });
      // To the end of the book: the last chapters drawn, the first ones not.
      await page.locator('.rows .note-row').first().focus();
      await page.keyboard.press('End');
      await expect.poll(() => focusedPos(page)).toBe('300');
      const from = page.locator('.rows .note-row[data-path="Big/Chapter 299.md"]');
      const to = page.locator('.rows .note-row[data-path="Big/Chapter 296.md"]');
      await expect(to).toBeInViewport();
      const a = await from.boundingBox();
      const b = await to.boundingBox();
      if (!a || !b) throw new Error('rows not drawn');
      await page.mouse.move(a.x + 40, a.y + a.height / 2);
      await page.mouse.down();
      for (let step = 1; step <= 10; step++)
        await page.mouse.move(b.x + 40, a.y + ((b.y + 4 - a.y) * step) / 10);
      await page.mouse.up();
      // Chapter 299 now stands just before Chapter 296, in the book's own order on disk.
      await expect
        .poll(() => {
          const folder = readQuietly(join(vault ?? '', 'Big', '.eien-folder.json'));
          const order = (JSON.parse(folder || '{}').order ?? []) as string[];
          return order.indexOf('Chapter 299.md') === order.indexOf('Chapter 296.md') - 1;
        })
        .toBe(true);
    },
  );
});

/**
 * A long chapter (#40, Phase 2): one of the book's files holding as many
 * paragraphs as a very long chapter has (600, some 27,000 words: five times
 * Pride and Prejudice's longest), drawn
 * whole, scrolled through and its place kept at each rest. Measured: no long
 * task drawing it or scrolling (none over 50 ms), 143 ms drawing it with the
 * CPU four times slower (SLOW=4).
 */
const LONG_CHAPTER = handEpub('content.opf', [
  {
    name: 'content.opf',
    data: opf(
      '3.0',
      [
        { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
        { id: 'c1', href: 'c1.xhtml', type: XHTML },
      ],
      ['c1'],
    ),
  },
  { name: 'nav.xhtml', data: nav([['The Long Chapter', 'c1.xhtml']]) },
  {
    name: 'c1.xhtml',
    data: xhtml(
      'The Long Chapter',
      `<h1>The Long Chapter</h1>\n${Array.from(
        { length: 600 },
        (_, n) =>
          `<p>Paragraph ${n}: it is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. <em>However little known</em> the feelings or views of such a man may be on his first entering a neighbourhood.</p>`,
      ).join('\n')}`,
    ),
  },
]);

test.describe('a long chapter', () => {
  test.use({ vaultFiles: { 'Novels/Long.epub': LONG_CHAPTER } });

  test(
    'opens, scrolls through and keeps its place without a stall',
    ALONE,
    async ({ page, vault }) => {
      test.setTimeout(90_000);
      const time = await stalls(page);
      const book = page.locator('.tree-row--epub .tree-row__name', { hasText: 'Long' });
      await expect(book).toBeVisible();
      await time.mark();
      await book.click();
      await expect(page.locator('.epub-chapter p')).toHaveCount(600);
      expect(await time.longest(), 'the chapter drawn').toBeLessThan(STALL);
      const scroller = page.locator('.page__leaf--epub .page__scroll');
      await scroller.focus();
      await time.mark();
      for (let i = 0; i < 40; i++) await page.keyboard.press('PageDown');
      await page.mouse.move(800, 400);
      for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 900);
      // At rest, its place measured and kept.
      const reading = join(vault ?? '', '.eien/reading');
      await expect
        .poll(() => (existsSync(reading) ? readdirSync(reading).length : 0), {
          timeout: 10_000,
        })
        .toBe(1);
      await expect(page.locator('.colophon .colophon__through').first()).not.toHaveText(
        '0% of the chapter',
      );
      expect(await time.longest(), 'scrolled and kept').toBeLessThan(STALL);
    },
  );
});

/**
 * Fifty turns (#40, Phase 3b): the long chapter in pages, turned on fifty
 * times by key under each Page turn, each turn's motion run to its end.
 * Measured: the curl's fourteen copies of the whole chapter were 215 ms, so
 * a turn copies the page in sight alone; now no long task (none over 50 ms)
 * under any of the three, the CPU four times slower too (SLOW=4). Held to
 * the same 200 ms as the rest.
 */
test.describe('fifty turns in a long chapter', () => {
  for (const turn of ['curl', 'slide', 'words'] as const) {
    test.describe(turn, () => {
      test.use({
        vaultFiles: { 'Novels/Long.epub': LONG_CHAPTER },
        deviceFile: {
          settings: { 'epub.view': 'pages', 'epub.turn': turn, 'epub.turnSpeed': '1' },
        },
      });

      test(`turns fifty pages without a stall (${turn})`, ALONE, async ({ page }) => {
        test.setTimeout(120_000);
        const time = await stalls(page);
        await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Long' }).click();
        await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter p')).toHaveCount(
          600,
        );
        const scroller = page.locator('.page__leaf--epub .page__scroll');
        await scroller.focus();
        await time.mark();
        for (let i = 0; i < 50; i++) {
          await page.keyboard.press('ArrowRight');
          // Each turn's motion to its end, as a reader reading at its pace would leave it.
          await expect(page.locator('.turn-curl, .turn-copy')).toHaveCount(0);
        }
        // The chapter's own figure, matched whole: "10% of the chapter" holds "0% of the chapter".
        await expect(page.locator('.colophon .colophon__through').first()).not.toHaveText(
          '0% of the chapter',
        );
        expect(await time.longest(), `fifty turns (${turn})`).toBeLessThan(STALL);
      });
    });
  }
});

/**
 * Fifty turns on a spread (#40, Phase 3d): the long chapter two pages at a
 * time, justified and hyphenated where the window can, curled fifty times;
 * then the pane widened past a spread and narrowed short of it, each laying
 * the chapter out anew. Held to the same 200 ms as the rest.
 */
test.describe('fifty turns on a spread', () => {
  test.use({
    vaultFiles: { 'Novels/Long.epub': LONG_CHAPTER },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turn': 'curl', 'epub.turnSpeed': '1' } },
  });

  test(
    'turns fifty spreads and opens and closes one without a stall',
    ALONE,
    async ({ page, app }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 1900, height: 900 });
      const time = await stalls(page);
      await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Long' }).click();
      const sheet = page.locator('.page__leaf--epub .epub-sheet:not([aria-hidden])');
      await expect(sheet.locator('.epub-chapter p')).toHaveCount(600);
      await clickMenu(app, 'View', 'Toggle Note List');
      await expect(sheet.locator('.epub__pages')).toHaveAttribute('data-spread', '');
      await page.locator('.page__leaf--epub .page__scroll').focus();
      await time.mark();
      for (let i = 0; i < 50; i++) {
        await page.keyboard.press('ArrowRight');
        await expect(page.locator('.turn-curl, .turn-copy')).toHaveCount(0);
      }
      await expect(page.locator('.colophon .colophon__through').first()).not.toHaveText(
        '0% of the chapter',
      );
      expect(await time.longest(), 'fifty turns on a spread').toBeLessThan(STALL);
      await time.mark();
      for (const width of [1100, 1900, 1100, 1900]) {
        await page.setViewportSize({ width, height: 900 });
        const pages = sheet.locator('.epub__pages');
        if (width > 1500) await expect(pages).toHaveAttribute('data-spread', '');
        else await expect(pages).not.toHaveAttribute('data-spread');
      }
      expect(await time.longest(), 'a spread opened and closed').toBeLessThan(STALL);
    },
  );
});

/** A book of about 3,000 steady pages (#40, Phase 4), and one chapter far longer than the rest, never drawn. */
const COUNTED_BOOK = longBook({ chapters: 60, paragraphs: 600, large: 4000 });

/**
 * A long book counted for its page numbers (#40, Phase 4): every chapter read
 * and counted in the background, one a task and only while no page turns, as
 * the pages turn, fifty of them. No long task over the same 200 ms, the large
 * chapter's included; then the steady pages said. Measured: no long task (none
 * over 50 ms); the longest 91 ms with the CPU four times slower (SLOW=4).
 */
test.describe('a long book counted while its pages turn', () => {
  test.use({
    vaultFiles: { 'Novels/Long.epub': COUNTED_BOOK },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turn': 'curl', 'epub.turnSpeed': '1' } },
  });

  test('counts it without a stall, then numbers its pages', ALONE, async ({ page }) => {
    test.setTimeout(180_000);
    const time = await stalls(page);
    await time.mark();
    await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Long' }).click();
    await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter p')).toHaveCount(600);
    await page.locator('.page__leaf--epub .page__scroll').focus();
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.turn-curl, .turn-copy')).toHaveCount(0);
    }
    await expect(page.locator('.colophon__page')).toHaveText(/^page \d+ of 3,\d{3}$/u, {
      timeout: 60_000,
    });
    expect(await time.longest(), 'a long book counted, fifty turns').toBeLessThan(STALL);
  });
});

/**
 * A long book searched (#40, Phase 5c), the same one: the list's field finds a
 * word in every paragraph (the count's limit reached in the second chapter, a
 * thousand rows drawn), then one in each chapter's last paragraph, so every
 * chapter is read, the 4,000-paragraph one too, a chapter a task and never
 * while a page turns, as fifty pages turn. No long task over the same
 * 200 ms. Measured on CI with BUDGETS=1 (and SLOW=4) before it was set; the
 * numbers are in the pull request.
 */
test.describe('a long book searched while its pages turn', () => {
  test.use({
    vaultFiles: { 'Novels/Long.epub': COUNTED_BOOK },
    deviceFile: { settings: { 'epub.view': 'pages', 'epub.turn': 'curl', 'epub.turnSpeed': '1' } },
  });

  test('finds a word through the whole book without a stall', ALONE, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const time = await stalls(page);
    await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Long' }).click();
    await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter p')).toHaveCount(600);
    // MEASURE (throwaway): a trace of the window from the mark to the first turn.
    const cdp = await page.context().newCDPSession(page);
    const traced: unknown[] = [];
    cdp.on('Tracing.dataCollected', (e) => traced.push(...(e.value as unknown[])));
    const traceDone = new Promise((done) => cdp.once('Tracing.tracingComplete', done));
    if (!process.env.NOTRACE)
      await cdp.send('Tracing.start', {
        transferMode: 'ReportEvents',
        traceConfig: {
          includedCategories: [
            'devtools.timeline',
            'disabled-by-default-devtools.timeline',
            'disabled-by-default-devtools.timeline.stack',
            'v8.execute',
            'blink',
            'blink.user_timing',
            'v8',
            'cppgc',
            'loading',
            'toplevel',
            'accessibility',
            'disabled-by-default-v8.gc',
          ],
        },
      });
    await time.mark();
    const search =
      process.env.LOCATORS === 'css'
        ? page.locator('input[type="search"][aria-label="Search Pride and Prejudice"]')
        : page.getByRole('searchbox', { name: 'Search Pride and Prejudice' });
    // In every paragraph: stops at the count's limit, its thousand rows drawn as they come.
    await search.fill('universally');
    await expect(page.locator('.list__empty')).toHaveText(/^More than 1,000/u, { timeout: 60_000 });
    await expect(page.locator('.found-row')).toHaveCount(1000);
    // Once a chapter, the last paragraph's: every chapter read, the large one's too.
    await search.fill('Paragraph 599:');
    await page.locator('.page__leaf--epub .page__scroll').focus();
    for (let i = 0; i < 50; i++) {
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.turn-curl, .turn-copy')).toHaveCount(0);
      if (i === 3 && !process.env.NOTRACE) {
        await cdp.send('Tracing.end');
        await traceDone;
        writeFileSync(
          join(test.info().outputPath(), 'trace.json'),
          JSON.stringify({ traceEvents: traced }),
        );
      }
    }
    await expect(
      process.env.LOCATORS === 'css'
        ? page.locator('[data-key="lens:found"] .count', { hasText: /^61$/u })
        : page.getByRole('button', { name: 'Found 61' }),
    ).toBeVisible({ timeout: 120_000 });
    const longest = await time.longest();
    const out = test.info().outputPath();
    const record = await page.evaluate(() => (window as unknown as { long: unknown }).long);
    writeFileSync(join(out, 'frames.json'), JSON.stringify({ longest, long: record }));
    console.log(`MEASURE ${JSON.stringify({ longest, long: record })}`);
    expect(longest, 'a long book searched, fifty turns').toBeLessThan(STALL);
  });
});
