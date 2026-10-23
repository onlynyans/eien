// Speed budgets (docs/backlog.md, the performance foundation): what a writer
// does with thousands of notes, held to a time. A long task is the window
// unable to answer: over 200 ms is a stall a writer feels. Long lists draw
// only the rows in sight (src/ui/shell/windowed-rows.ts), and the keyboard
// still reaches every row. Each runs alone (ALONE), so it measures Eien.

import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { ALONE, expect, readQuietly, test, type VaultFiles } from './launch';

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
      await expect(page.locator('.page__pages > .page__scroll')).toHaveCount(2);
      for (let i = 2; i < 6; i++) await rows.nth(i).click(); // notes on the active page
      await page.locator('.page__pages > .page__scroll:not([data-active]) .sheet').click();
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
