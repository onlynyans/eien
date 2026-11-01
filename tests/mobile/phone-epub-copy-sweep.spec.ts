// A turn's copy of the page is the page as laid (#60, #160, #169, #170):
// across screens from 240px to 1600px, text sizes and Page zooms, and a
// chapter of every kind of block (paragraphs long and short, hyphenated and,
// where the window can, justified; pictures in a line and as plates; a
// Calibre SVG plate; scene breaks; epigraphs; headings; a numbered list
// across pages), typefaces and line spacings that make a line a part of a
// pixel tall, every line, picture and rule in the copy stands where the page
// had it, to the hundredth of a pixel; and so on the last pages of a chapter
// of four thousand paragraphs, a thousand columns and more before them.
// Property-style: the screens are drawn from a seed (FC_SEED for another),
// the ends of the range always in.

import { devices, expect, type Page, test } from '@playwright/test';
import fc from 'fast-check';
import { page as chapterPage, handEpub, nav, opf, XHTML } from '../support/epub-parts';
import { png } from '../support/images';
import { longBook } from '../support/long-book';
import { openBookOn, openChapter } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

const SEED = Number(process.env.FC_SEED ?? 4040);

const LINE =
  'The rain kept on through the evening, incomprehensibilities notwithstanding, and the lamps along the quay were lit characteristically early before the boats came in, one by one, low in the water.';
const SHORT = 'She said nothing.';
const FRAME =
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="100%" height="100%" viewBox="0 0 800 1200" preserveAspectRatio="xMidYMid meet"><image width="800" height="1200" xlink:href="images/tall.svg"/></svg>';
const TALL =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200"><rect width="800" height="1200" fill="#888"/></svg>';

/** The blocks of the chapter, every kind turning up at a different period, so pages begin on each. */
function block(n: number): string {
  const parts = [`<p>${LINE.repeat(1 + (n % 4))}</p>`];
  if (n % 3 === 0) parts.push(`<p>${SHORT}</p>`);
  if (n % 5 === 1) parts.push(`<p>${LINE} <img src="images/small.png" alt=""/> ${LINE}</p>`);
  if (n % 7 === 2) parts.push('<div class="illus"><img src="images/plate.png" alt=""/></div>');
  if (n % 6 === 3) parts.push('<hr class="transition"/>');
  if (n % 9 === 4) parts.push(`<blockquote epub:type="epigraph"><p>${LINE}</p></blockquote>`);
  if (n % 11 === 5) parts.push(`<div class="svg_outer_wrapper">${FRAME}</div>`);
  if (n % 8 === 6) parts.push(`<ol>${`<li>${LINE}</li>`.repeat(6)}</ol>`);
  if (n % 10 === 7) parts.push(`<h2>Part ${n}</h2>`);
  return parts.join('\n');
}

const mixedBook = () =>
  handEpub('content.opf', [
    {
      name: 'content.opf',
      data: opf(
        '3.0',
        [
          { id: 'nav', href: 'nav.xhtml', type: XHTML, properties: 'nav' },
          { id: 'c0', href: 'c0.xhtml', type: XHTML },
          { id: 'c1', href: 'c1.xhtml', type: XHTML },
          { id: 'small', href: 'images/small.png', type: 'image/png' },
          { id: 'plate', href: 'images/plate.png', type: 'image/png' },
          { id: 'tall', href: 'images/tall.svg', type: 'image/svg+xml' },
        ],
        ['c0', 'c1'],
      ),
    },
    {
      name: 'nav.xhtml',
      data: nav([
        ['Opening', 'c0.xhtml'],
        ['Every kind', 'c1.xhtml'],
      ]),
    },
    // The first chapter carries Eien's title page: the kinds are the second's.
    { name: 'c0.xhtml', data: chapterPage('Opening', '<h1>Opening</h1><p>Before.</p>') },
    {
      name: 'c1.xhtml',
      data: chapterPage(
        'Every kind',
        `<h1>Every kind</h1>\n${Array.from({ length: 40 }, (_, n) => block(n)).join('\n')}`,
      ),
    },
    { name: 'images/small.png', data: png(120, 80) },
    { name: 'images/plate.png', data: png(800, 560) },
    { name: 'images/tall.svg', data: TALL },
  ]);

interface Room {
  readonly width: number;
  readonly height: number;
  readonly textSize: number;
  readonly zoom: number;
  readonly face: 'newsreader' | 'literata' | 'atkinson' | 'plex-sans';
  readonly leading: 'tight' | 'set' | 'loose';
}

const AS_SET = { face: 'newsreader', leading: 'set' } as const;

const ROOMS: readonly Room[] = [
  { width: 240, height: 640, textSize: 100, zoom: 100, ...AS_SET },
  { width: 1600, height: 900, textSize: 100, zoom: 100, ...AS_SET },
  ...fc.sample(
    fc.record({
      width: fc.integer({ min: 240, max: 1600 }),
      height: fc.integer({ min: 480, max: 1000 }),
      textSize: fc.constantFrom(90, 100, 110, 120),
      zoom: fc.constantFrom(100, 110, 130, 150),
      face: fc.constantFrom('newsreader', 'literata', 'atkinson', 'plex-sans'),
      leading: fc.constantFrom('tight', 'set', 'loose'),
    }),
    { numRuns: 6, seed: SEED },
  ),
];

/** What's in sight: each line (its column, foot, left and right), picture and rule (left, top, width, height). */
interface Seen {
  readonly lines: readonly (readonly number[])[];
  readonly pictures: readonly (readonly number[])[];
  readonly rules: readonly (readonly number[])[];
}

/**
 * What's in the box's sight under `within`, from the box's corner: each line
 * (its text's boxes on one line joined, so ink wrapping words splits nothing),
 * each picture and each rule.
 */
const inSight = (page: Page, within: string): Promise<Seen | null> =>
  page.evaluate((selector) => {
    const box = document.querySelector('.epub-sheet:not([aria-hidden]) .epub__pages');
    const holder = document.querySelector(selector);
    if (!box || !holder) return null;
    const at = box.getBoundingClientRect();
    const seen = (rect: DOMRect) =>
      rect.width >= 1 && rect.right > at.left + 2 && rect.left < at.right - 2;
    // A spread's two pages each hold their own lines; a single page, one.
    const spread = box.hasAttribute('data-spread');
    const lines = new Map<string, number[]>();
    const texts = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
    for (let text = texts.nextNode(); text; text = texts.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        if (!seen(rect)) continue;
        // A line by its column and its foot.
        const column = spread && rect.left - at.left > at.width / 2 ? 1 : 0;
        const foot = rect.bottom - at.top;
        const key = `${column}:${foot.toFixed(2)}`;
        const line = lines.get(key);
        lines.set(key, [
          column,
          foot,
          Math.min(line?.[2] ?? rect.left - at.left, rect.left - at.left),
          Math.max(line?.[3] ?? rect.right - at.left, rect.right - at.left),
        ]);
      }
    }
    const boxes = (names: string) =>
      [...holder.querySelectorAll(names)]
        .map((element) => element.getBoundingClientRect())
        .filter(seen)
        .map((rect) => [rect.left - at.left, rect.top - at.top, rect.width, rect.height]);
    const order = (a: number[], b: number[]) =>
      (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0);
    return {
      lines: [...lines.values()].sort(order),
      pictures: boxes('img'),
      rules: boxes('hr, .scene-break'),
    };
  }, within);

/** `copy` as `page`, every figure within `within` of the page's: else told as the two side by side. */
function sameAs(copy: Seen | null, page: Seen | null, within: number, label: string) {
  const near = (a: readonly (readonly number[])[], b: readonly (readonly number[])[]) =>
    a.length === b.length &&
    a.every(
      (each, i) =>
        each.length === b[i]?.length &&
        each.every((n, j) => Math.abs(n - (b[i]?.[j] ?? Number.NaN)) <= within),
    );
  const kept =
    !!copy &&
    !!page &&
    near(copy.lines, page.lines) &&
    near(copy.pictures, page.pictures) &&
    near(copy.rules, page.rules);
  const said = (seen: Seen | null) =>
    seen &&
    Object.fromEntries(
      Object.entries(seen).map(([name, all]) => [
        name,
        all.map((each: number[]) => each.map((n) => n.toFixed(3)).join(' ')),
      ]),
    );
  if (!kept) expect(said(copy), label).toEqual(said(page));
}

async function openBook(page: Page, room: Room, bytes: Uint8Array, chapter: string) {
  await openBookOn(page, bytes, room, {
    'epub.appearance.textSize': room.textSize,
    'page.zoom': room.zoom,
    'appearance.face': room.face,
    'appearance.leading': room.leading,
  });
  const words = page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter');
  await expect(words).toBeVisible();
  await openChapter(page, chapter);
  await expect(page.locator('.colophon .colophon__page').first()).toContainText('page');
  // Every picture drawn and sized before a page is compared.
  await expect
    .poll(() =>
      words.evaluate((element) =>
        [...element.querySelectorAll('img')].every((img) => img.complete && img.naturalWidth > 0),
      ),
    )
    .toBe(true);
}

/** A hundredth of a pixel: the copy's lines are the page's. */
const EXACT = 0.01;

/**
 * A turn `key` away, its copy held at its first frame and read, every figure
 * `within` of the page's, then let go.
 */
async function copyMatches(page: Page, key: string, label: string, within = EXACT) {
  const chapter = '.epub-sheet:not([aria-hidden]) .epub-chapter';
  const copied = '.turn-copy [data-turn-words]';
  const before = await inSight(page, chapter);
  await page.keyboard.press(key);
  await expect(page.locator(copied)).toBeAttached();
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) {
      animation.pause();
      animation.currentTime = 0;
    }
  });
  const copy = await inSight(page, copied);
  sameAs(copy, before, within, label);
  await page.evaluate(() => {
    for (const animation of document.getAnimations()) animation.finish();
  });
  await expect(page.locator(copied)).not.toBeAttached({ timeout: 10_000 });
  return before;
}

for (const room of ROOMS) {
  const name = `${room.width}×${room.height}, text ${room.textSize}%, zoom ${room.zoom}%, ${room.face}, ${room.leading}`;
  test(`a turn’s copy is the page as laid: ${name} (seed ${SEED})`, async ({ page }) => {
    test.setTimeout(120_000);
    await openBook(page, room, mixedBook(), 'Every kind');
    await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter')).toContainText(
      'The rain kept on',
    );
    await page.locator('.page__leaf--epub .page__scroll').first().focus();
    let kinds = 0;
    for (let turn = 1; turn <= 14; turn++) {
      const seen = await copyMatches(page, 'ArrowRight', `${name}, turn ${turn} on`);
      if (seen && seen.lines.length + seen.pictures.length + seen.rules.length > 0) kinds++;
    }
    for (let turn = 1; turn <= 3; turn++) {
      await copyMatches(page, 'ArrowLeft', `${name}, turn ${turn} back`);
    }
    // Pages compared held something: lines, pictures or rules.
    expect(kinds).toBeGreaterThan(10);
  });
}

// The last pages of a chapter as long as a book in one file: the run's first block a thousand
// columns and more in, its place measured there as at the start. The page itself is moved there by
// a translate of hundreds of thousands of pixels, which the window holds as a 32-bit float, to a
// sixteenth of a pixel at most: the copy is held to that.
const FLOAT_AT_A_MILLION = 1 / 16;
const LONG_ROOMS: readonly Room[] = [
  { width: 412, height: 915, textSize: 110, zoom: 130, face: 'literata', leading: 'loose' },
  { width: 1500, height: 820, textSize: 100, zoom: 110, ...AS_SET },
];
for (const room of LONG_ROOMS) {
  test(`a turn’s copy is the page as laid at the end of a long chapter, ${room.width}px, zoom ${room.zoom}%`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openBook(page, room, longBook({ chapters: 1, paragraphs: 4000 }), 'Chapter 1');
    await expect(page.locator('.epub-sheet:not([aria-hidden]) .epub-chapter p')).toHaveCount(4000, {
      timeout: 30_000,
    });
    await page.locator('.page__leaf--epub .page__scroll').first().focus();
    await page.keyboard.press('End');
    // On the chapter's last page: its number (a spread's second) the count.
    await expect
      .poll(async () => {
        const said = (await page.locator('.colophon .colophon__page').first().textContent()) ?? '';
        const numbers = said.replaceAll(',', '').match(/\d+/gu) ?? [];
        return numbers.length > 1 && numbers.at(-1) === numbers.at(-2);
      })
      .toBe(true);
    for (let turn = 1; turn <= 6; turn++) {
      await copyMatches(
        page,
        'ArrowLeft',
        `the long chapter's end, turn ${turn} back`,
        FLOAT_AT_A_MILLION,
      );
    }
  });
}
