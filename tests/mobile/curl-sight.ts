// The curl as the screen shows it: what the specs that read its pixels share
// (./curl-look.spec.ts, ./curl-shadows.spec.ts). A book on a sheet with the
// blotter round it, a finger holding a page curled still, and the screen's
// lightness at points on it.

import { readFileSync } from 'node:fs';
import { type CDPSession, expect, type Page } from '@playwright/test';
import { box, FIXTURE, touchAt } from './book-hand';
import { open, putBytesOutside } from './outside';

export type Point = readonly [number, number];
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The screen's lightness (0 to 255) at each point, in CSS pixels, read from a
 * screenshot at the device's own pixels. Decoded in a blank page of its own,
 * as the phone's page allows no image from elsewhere.
 */
export async function lightness(page: Page, points: readonly Point[]): Promise<number[]> {
  const shot = await page.screenshot();
  const ratio = await page.evaluate(() => devicePixelRatio);
  const blank = await page.context().newPage();
  try {
    return await blank.evaluate(
      async ([png, points, ratio]) => {
        const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes]));
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('no canvas');
        context.drawImage(image, 0, 0);
        const { data } = context.getImageData(0, 0, image.width, image.height);
        return points.map(([x, y]) => {
          const at = (Math.round(y * ratio) * image.width + Math.round(x * ratio)) * 4;
          return (
            0.2126 * (data[at] ?? 0) + 0.7152 * (data[at + 1] ?? 0) + 0.0722 * (data[at + 2] ?? 0)
          );
        });
      },
      [shot.toString('base64'), points, ratio] as const,
    );
  } finally {
    await blank.close();
  }
}

export const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? Number.NaN;

/**
 * A finger put on the page at `from` and drawn slowly to `to`, then held
 * there: the curl stands still under it (its bands no longer moving) before
 * anything is read. Lifted by the function returned.
 */
export async function holdCurl(page: Page, from: Point, to: Point): Promise<() => Promise<void>> {
  const cdp: CDPSession = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(...from) });
  const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / 8);
  for (let i = 1; i <= steps; i++) {
    const x = from[0] + ((to[0] - from[0]) * i) / steps;
    const y = from[1] + ((to[1] - from[1]) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touchAt(x, y) });
    await page.waitForTimeout(16);
  }
  await expect(page.locator('.turn-curl')).toHaveCount(1);
  const placed = () =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('.turn-curl__band')]
        .map((band) => band.style.transform)
        .join(),
    );
  await expect
    .poll(
      async () => {
        const before = await placed();
        await page.waitForTimeout(100);
        return (await placed()) === before;
      },
      { intervals: [0] },
    )
    .toBe(true);
  return async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 10_000 });
  };
}

export const sheetOf = async (page: Page): Promise<Rect> => {
  const sheet = await page.locator('.epub-sheet:not([aria-hidden])').boundingBox();
  if (!sheet) throw new Error('no sheet');
  return sheet;
};

/**
 * A book in pages on the desktop's panes, on a sheet with the blotter round
 * it: one page, or with `two` two facing pages on a wide screen.
 */
export async function bookOnASheet(page: Page, two = false): Promise<Rect> {
  await open(page);
  await page.evaluate(async (two) => {
    await window.eien.settings.set('appearance.room', 'panes');
    await window.eien.settings.set('appearance.frame', 'sheet');
    await window.eien.settings.set('epub.view', 'pages');
    await window.eien.settings.set('epub.turn', 'curl');
    if (!two) await window.eien.settings.set('epub.landscape', 'one');
  }, two);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.setViewportSize({ width: two ? 2000 : 1400, height: 900 });
  await page.reload();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(box(page)).toBeVisible();
  if (two) await expect(box(page)).toHaveAttribute('data-spread', '');
  else await expect(box(page)).not.toHaveAttribute('data-spread', '');
  return sheetOf(page);
}

/**
 * Where the roll stands across the screen while a page curls on under a hand
 * drawn straight across (the fold upright): from the crest, over the fold,
 * to the roll's far side, where its shadow on the page beneath begins. Read
 * from the crest's and the cast's bands, their boxes' first edges, in the
 * layer they're laid in (a spread's turning page, or the whole curl).
 */
export const rollAcross = (page: Page) =>
  page.evaluate(() => {
    const curl = document.querySelector<HTMLElement>('.turn-curl');
    if (!curl) throw new Error('no curl');
    const zoom = (curl as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
    const edge = (name: string) => {
      const band = curl.querySelector<HTMLElement>(`.turn-curl__${name}`);
      if (!band) throw new Error(`no ${name}`);
      const left = (band.closest('.turn-curl__leaf') ?? curl).getBoundingClientRect().left;
      return left + new DOMMatrix(band.style.transform).transformPoint(new DOMPoint(0, 0)).x * zoom;
    };
    return { crest: edge('crest'), side: edge('cast') };
  });
