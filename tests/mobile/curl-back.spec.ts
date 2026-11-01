// A spread's page turned over (#40, the curl's back face): its back is the
// page the turn reveals across the gutter, printed there and mirrored as
// paper's back is, so as the page lands its words lie where the sheet has
// them, the right way round. Watched frame by frame through a key's turn on
// two facing pages: two words of a line on the back, against the same words
// on the sheet's new left page.

import { readFileSync } from 'node:fs';
import { devices, expect, type Page, test } from '@playwright/test';
import { box, FIXTURE } from './book-hand';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

type Seen = { back: number[]; sheet: number[] };

/** A book in pages on two facing pages, the desktop's panes on a wide screen, turning slowly. */
async function bookOnTwoPages(page: Page): Promise<void> {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.room', 'panes');
    await window.eien.settings.set('epub.view', 'pages');
    await window.eien.settings.set('epub.turn', 'curl');
    await window.eien.settings.set('epub.turnSpeed', '4');
  });
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.setViewportSize({ width: 2000, height: 900 });
  await page.reload();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(box(page)).toHaveAttribute('data-spread', '');
  await page.locator('.page__leaf--epub .page__scroll').focus();
}

/**
 * A key's turn watched every frame: where two words of a line (`first` and
 * `last`, found in one text and nowhere else) stand on the curl's back, and
 * on the sheet beneath (the page come to).
 */
async function turnWatched(page: Page, key: string, [first, last]: readonly [string, string]) {
  const frames = page.evaluate(
    ([first, last]) =>
      new Promise<Seen[]>((done) => {
        const seen: Seen[] = [];
        let begun = false;
        /** The words' middles in the first text of `root` holding both. */
        const wordsIn = (root: Element): number[] | null => {
          const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let node = walk.nextNode(); node; node = walk.nextNode()) {
            const text = node.textContent ?? '';
            const [a, b] = [text.indexOf(first), text.indexOf(last)];
            if (a < 0 || b < 0) continue;
            const middle = (at: number, word: string) => {
              const range = document.createRange();
              range.setStart(node, at);
              range.setEnd(node, at + word.length);
              const r = range.getBoundingClientRect();
              return [r.left + r.width / 2, r.top + r.height / 2];
            };
            return [...middle(a, first), ...middle(b, last)];
          }
          return null;
        };
        const tick = () => {
          const back = document.querySelector('.turn-curl__back .turn-curl__page');
          if (!back && begun) return done(seen);
          begun ||= back !== null;
          const sheet = document.querySelector('.epub-sheet:not([aria-hidden]) .epub-chapter');
          const backWords = back && wordsIn(back);
          const sheetWords = sheet && wordsIn(sheet);
          if (backWords && sheetWords) seen.push({ back: backWords, sheet: sheetWords });
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    [first, last] as const,
  );
  await page.keyboard.press(key);
  return frames;
}

/** The back seen through a turn: read left to right as it comes over, landing on the sheet's words. */
function expectLanded(seen: Seen[]): void {
  expect(seen.length).toBeGreaterThan(10);
  // Every frame the line reads left to right: the back is mirrored, as paper's is, and turned over.
  for (const { back } of seen) expect(back[0]).toBeLessThan(back[2] as number);
  // Landing: each word within a few pixels of the sheet's.
  const last = seen.at(-1) as Seen;
  last.back.forEach((at, i) => {
    expect(Math.abs(at - (last.sheet[i] as number))).toBeLessThan(6);
  });
  // And the back was elsewhere as the page rose: what lands is what turned over.
  const first = seen[0] as Seen;
  expect(Math.abs((first.back[0] as number) - (first.sheet[0] as number))).toBeGreaterThan(50);
}

test('a spread’s page turned on lands its back’s words where the sheet has them', async ({
  page,
}) => {
  await bookOnTwoPages(page);
  // A line of the next spread's left page.
  expectLanded(await turnWatched(page, 'ArrowRight', ['replied', 'wife,']));
});

test('a spread’s page turned back lands its back’s words where the sheet has them', async ({
  page,
}) => {
  await bookOnTwoPages(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 20_000 });
  // A line of the spread before's right page.
  expectLanded(await turnWatched(page, 'ArrowLeft', ['married', 'single?']));
});
