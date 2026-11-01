// The curl as it's seen (#40, the curl made smooth): each piece a band, its
// page laid back inside it and its veil, shade and light over that page
// (src/ui/epub/turn/band-box.ts). What the layers' and frames' specs can't
// see, read here from the screen's own pixels while a finger holds a page:
// a page's back shows its words only faintly; a flap pulled off the sheet
// shows on the blotter as far as the pane reaches, as it did before the
// curl clipped itself; and the shade and light, drawn across bands far
// longer than the page, never fall on the blotter round it.

import { devices, expect, type Page, test } from '@playwright/test';
import { bookInPages, box } from './book-hand';
import { bookOnASheet, holdCurl, lightness, median, type Point } from './curl-sight';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

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

/** A book in pages on one page on a sheet, with room for a flap to its left on the blotter. */
async function bookBesideBlotter(page: Page) {
  const sheet = await bookOnASheet(page);
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
  const sheet = await bookBesideBlotter(page);
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
  const sheet = await bookBesideBlotter(page);
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
