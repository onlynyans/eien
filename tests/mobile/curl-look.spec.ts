// The curl as it's seen (#40, the curl made smooth): each piece a band, its
// page laid back inside it and its veil, shade and light over that page
// (src/ui/epub/turn/band-box.ts). What the layers' and frames' specs can't
// see, read here from the screen's own pixels while a finger holds a page:
// a page's back shows its words only faintly; a flap pulled off the sheet
// shows on the blotter as far as the pane reaches, as it did before the
// curl clipped itself; and the shade and light, drawn across bands far
// longer than the page, never fall on the blotter round it.

import { readFileSync } from 'node:fs';
import { type CDPSession, devices, expect, type Page, test } from '@playwright/test';
import { bookInPages, box, FIXTURE, touchAt } from './book-hand';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

type Point = readonly [number, number];
interface Rect {
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
async function lightness(page: Page, points: readonly Point[]): Promise<number[]> {
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

const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? Number.NaN;

/**
 * A finger put on the page at `from` and drawn slowly to `to`, then held
 * there: the curl stands still under it (its bands no longer moving) before
 * anything is read. Lifted by the function returned.
 */
async function holdCurl(page: Page, from: Point, to: Point): Promise<() => Promise<void>> {
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

/**
 * Points on the screen inside the bands `selector` names, each in the middle
 * of its band's width and on the page (a band reaches far past the page along
 * the fold; what's past it isn't drawn). Found through the bands' own
 * matrices: the band's box laid by `place`, the page in it by `paper`.
 */
const insideBands = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const curl = document.querySelector<HTMLElement>('.turn-curl');
    if (!curl) throw new Error('no curl');
    const zoom = (curl as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom ?? 1;
    const origin = curl.getBoundingClientRect();
    const points: [number, number][] = [];
    for (const band of curl.querySelectorAll<HTMLElement>(selector)) {
      if (band.style.visibility === 'hidden') continue;
      const inside = band.querySelector<HTMLElement>(':scope > .turn-curl__inside');
      if (!inside) continue;
      const place = new DOMMatrix(band.style.transform);
      const toPage = new DOMMatrix(inside.style.transform).inverse();
      for (let u = 20; u <= 80; u += 10) {
        for (let v = 0; v <= band.offsetHeight; v += 2) {
          const onPage = toPage.transformPoint(new DOMPoint(u, v));
          if (onPage.x < 4 || onPage.y < 4) continue;
          if (onPage.x > inside.offsetWidth - 4 || onPage.y > inside.offsetHeight - 4) continue;
          const at = place.transformPoint(new DOMPoint(u, v));
          points.push([origin.left + at.x * zoom, origin.top + at.y * zoom]);
        }
      }
    }
    return points;
  }, selector);

const sheetOf = async (page: Page): Promise<Rect> => {
  const sheet = await page.locator('.epub-sheet:not([aria-hidden])').boundingBox();
  if (!sheet) throw new Error('no sheet');
  return sheet;
};

/** A book in pages on the desktop's panes, one page on a sheet with the blotter round it. */
async function bookOnASheet(page: Page): Promise<Rect> {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.room', 'panes');
    await window.eien.settings.set('appearance.frame', 'sheet');
    await window.eien.settings.set('epub.view', 'pages');
    await window.eien.settings.set('epub.turn', 'curl');
    await window.eien.settings.set('epub.landscape', 'one');
  });
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.reload();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await expect(box(page)).toBeVisible();
  await expect(box(page)).not.toHaveAttribute('data-spread', '');
  const sheet = await sheetOf(page);
  // Room for a flap to the sheet's left, on the blotter, inside the pane.
  const pane = await page
    .locator('.epub-sheet:not([aria-hidden])')
    .evaluate((element) => element.parentElement?.getBoundingClientRect().left ?? 0);
  expect(sheet.x - pane).toBeGreaterThan(120);
  return sheet;
}

// The back half of the roll is the page's other side, its words mirrored
// and faint through its own paper: the veil lies over the copy inside each
// band. A copy over its veil (a copy laid over the sheet stands at 3) showed
// the words at full ink there.
test('a page’s back, mid-roll, shows its words only faintly', async ({ page }) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const y = rect.y + rect.height * 0.6;
  const lift = await holdCurl(page, [rect.x + rect.width * 0.9, y], [rect.x + rect.width * 0.4, y]);
  const back = await insideBands(page, '.turn-curl__strip:has(.turn-curl__paper)');
  const front = await insideBands(page, '.turn-curl__front');
  expect(back.length).toBeGreaterThan(1000);
  const [backs, fronts] = [await lightness(page, back), await lightness(page, front)];
  await lift();
  // The words' full ink, and the paper, from the page lying flat beside the roll.
  const ink = Math.min(...fronts);
  const paper = Math.max(...fronts);
  expect(paper - ink).toBeGreaterThan(150);
  // The darkest a back's word comes is far nearer the paper than the ink (it's three quarters of
  // the way; a copy over its veil, none).
  expect((Math.min(...backs) - ink) / (paper - ink)).toBeGreaterThan(0.5);
});

// The curl clips itself, so its bands (far longer than the page) never widen
// the window's bounds as they move. It clips where the pane the sheet lies in
// cuts, so a flap pulled off the sheet shows on the blotter as it did when
// the pane alone cut it; clipped at the sheet, it vanished at the sheet's edge.
test('a flap pulled past the sheet’s edge shows on the blotter, as far as the pane', async ({
  page,
}) => {
  const sheet = await bookOnASheet(page);
  const y = sheet.y + sheet.height * 0.6;
  // Beside the sheet on the blotter, along the flap's middle, and on the sheet's margin.
  const beside: Point[] = [];
  for (let at = 0.35; at <= 0.75; at += 0.02)
    beside.push([sheet.x - 30, sheet.y + sheet.height * at]);
  const margin: Point = [sheet.x + 12, sheet.y + 12];
  const [paper, ...rest] = await lightness(page, [margin, ...beside]);
  const blotter = median(rest);
  if (paper === undefined) throw new Error('no paper');
  expect(paper - blotter).toBeGreaterThan(10);
  const lift = await holdCurl(page, [sheet.x + sheet.width * 0.95, y], [sheet.x - 120, y]);
  const held = median(await lightness(page, beside));
  await lift();
  // The flap's paper there, nearer the paper's lightness than the blotter's.
  expect(held).toBeGreaterThan((paper + blotter) / 2);
});

// A band's shade and light are drawn across its whole length, far past the
// page along the fold; inside the band they're cut to the page's box. Where
// the fold crosses the sheet's top and bottom edges, the blotter just past
// them is as it was before the page lifted.
test('the curl’s shade and light stop at the page’s edges', async ({ page }) => {
  const sheet = await bookOnASheet(page);
  const rows: Point[] = [];
  // Clear of the flap's own soft shadow, and of the book's fore-edge at the sheet's right.
  for (let x = sheet.x; x < sheet.x + sheet.width - 30; x += 3) {
    rows.push([x, sheet.y - 16], [x, sheet.y + sheet.height + 16]);
  }
  const resting = await lightness(page, rows);
  const y = sheet.y + sheet.height * 0.6;
  const lift = await holdCurl(
    page,
    [sheet.x + sheet.width * 0.95, y],
    [sheet.x + sheet.width * 0.4, y],
  );
  // The fold crosses the top and bottom edges between the hand and the grip.
  const held = await lightness(page, rows);
  await lift();
  const changed = held.map((value, i) => Math.abs(value - (resting[i] ?? value)));
  expect(Math.max(...changed)).toBeLessThan(4);
});
