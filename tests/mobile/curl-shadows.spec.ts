// The curl's two shadows as they're seen (#40, the curl's shadows): the
// roll's on the page beneath, and the lifted paper's round what lies back on
// top, each as strong as the paper is high off the page. Read from the
// screen's own pixels on the blotter round a sheet, while a finger holds a
// page: half over, what lies back casts its soft shadow past its free edges,
// and none over the roll, where its own shadow is (the flap's shadow round
// the whole lifted group doubled it there); landing all but flat, neither
// casts any, as at rest (both stayed whole to the last frame, and vanished
// in it). By day and by night.

import { devices, expect, type Page, test } from '@playwright/test';
import {
  bookOnASheet,
  holdCurl,
  lightness,
  median,
  type Point,
  type Rect,
  rollAcross,
} from './curl-sight';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

/** Just past the sheet's top and bottom edges, on the blotter, at each of `xs`. */
const pastTopAndBottom = (sheet: Rect, xs: readonly number[]): Point[] =>
  xs.flatMap((x) => [
    [x, sheet.y - 2],
    [x, sheet.y + sheet.height + 2],
  ]);

/** From `from` to `to`, every few pixels. */
const across = (from: number, to: number): number[] => {
  const xs: number[] = [];
  for (let x = from; x <= to; x += 3) xs.push(x);
  return xs;
};

/** How much darker each point is now than `before`. */
async function darkened(page: Page, points: readonly Point[], before: readonly number[]) {
  const now = await lightness(page, points);
  return now.map((value, i) => (before[i] ?? value) - value);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(colorScheme, () => {
    test.use({ colorScheme });

    // A hand drawn straight across a page, so the fold stands upright and what lies back has its
    // edges along the sheet's top and bottom.
    test('half over, what lies back casts its shadow past its edges, and none over the roll', async ({
      page,
    }) => {
      const sheet = await bookOnASheet(page);
      const y = sheet.y + sheet.height * 0.6;
      const hand = sheet.x + sheet.width * 0.1;
      // Every point along the sheet's top and bottom the curl might reach, read at rest first.
      const all = across(sheet.x + 10, sheet.x + sheet.width - 30);
      const resting = await lightness(page, pastTopAndBottom(sheet, all));
      const lift = await holdCurl(page, [sheet.x + sheet.width * 0.95, y], [hand, y]);
      const { crest, side } = await rollAcross(page);
      // The fold well inside the sheet, the roll a good width: the points below are where it says.
      expect(crest - hand).toBeGreaterThan(80);
      expect(side - crest).toBeGreaterThan(80);
      const now = await darkened(page, pastTopAndBottom(sheet, all), resting);
      await lift();
      const at = (from: number, to: number, of: readonly number[]) =>
        all.flatMap((x, i) =>
          x >= from && x <= to ? [of[2 * i] ?? Number.NaN, of[2 * i + 1] ?? Number.NaN] : [],
        );
      // What lies back, from past its free corner to short of the crest: its shadow on the blotter,
      // a share of the blotter's lightness (measured 0.04 by day, 8 to 10 of 221; 0.12 by night, 2 of
      // 17, the blotter all but black).
      const share = now.map((value, i) => value / (resting[i] ?? Number.NaN));
      expect(median(at(hand + 20, crest - 10, share))).toBeGreaterThan(0.02);
      // Over the roll, from the crest to its far side: nothing (measured 0; with the flap's shadow
      // round the whole lifted group, as strong as beside what lies back).
      const roll = at(crest + 10, side - 10, now);
      expect(Math.max(...roll)).toBeLessThan(3);
    });

    // On two facing pages the right page lands over the left, where the sheet stands on the
    // blotter: a hand held a little short of the left page's far edge, the paper all but flat (an
    // eighth of its height half over).
    test('as a page lands all but flat, neither shadow falls round it', async ({ page }) => {
      const sheet = await bookOnASheet(page, true);
      const y = sheet.y + sheet.height * 0.6;
      const gutter = sheet.x + sheet.width / 2;
      // Round the left page, where the page turned on comes to lie: above it, below it, and
      // beside its far edge.
      const round: Point[] = [...pastTopAndBottom(sheet, across(sheet.x + 10, gutter - 10))];
      for (let at = sheet.y + 10; at < sheet.y + sheet.height - 10; at += 3) {
        round.push([sheet.x - 2, at]);
      }
      const roundResting = await lightness(page, round);
      // Beside the gutter on the right page, in its margins above and below the words, where the
      // roll's shadow falls on the page beneath; where the roll will stand isn't known yet.
      const margins = [sheet.y + 12, sheet.y + sheet.height - 16];
      const beside = across(gutter, gutter + 80).flatMap((x) =>
        margins.map((at): Point => [x, at]),
      );
      const besideResting = await lightness(page, beside);
      const lift = await holdCurl(
        page,
        [sheet.x + sheet.width * 0.98, y],
        [sheet.x + sheet.width * 0.02, y],
      );
      const { side } = await rollAcross(page);
      expect(side - gutter).toBeLessThan(40);
      const cast = await darkened(page, beside, besideResting);
      const lifted = await darkened(page, round, roundResting);
      await lift();
      // The lifted paper's: measured 1 by day; at full strength there, 10.
      expect(Math.max(...lifted)).toBeLessThan(4);
      // The roll's, from its side on: measured 5 by day, where at full strength it's 36.
      const past = cast.filter((_, i) => (beside[i]?.[0] ?? 0) > side + 2);
      expect(past.length).toBeGreaterThan(20);
      expect(Math.max(...past)).toBeLessThan(10);
    });
  });
}
