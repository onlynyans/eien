// The curl's frames on a phone (#40, the curl made smooth): a Galaxy Z Fold's
// curl stuttered at 90% Interface zoom, its GPU rasterising the page again
// every frame (a clip and a light changed each frame are drawn anew each
// frame), up to 200 ms at a time. Now the curl's bands are drawn as the turn
// begins and only moved. Traced in Chromium on the phone's page, the CPU four
// times slower: while a finger holds the page and moves, its words are never
// rasterised again, and the window's frames keep the screen's pace.

import { type Browser, type CDPSession, devices, expect, type Page, test } from '@playwright/test';
import { bookInPages, box, touchAt } from './book-hand';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

/** A trace's events, as far as these use. */
interface TraceEvent {
  readonly name: string;
  readonly ph: string;
  readonly dur: number;
}

/** The book at the owner's 90% Interface zoom, in pages, the CPU four times slower. */
async function slowPhone(page: Page): Promise<CDPSession> {
  await bookInPages(page);
  await page.evaluate(() => window.eien.settings.set('window.zoom', 90));
  await expect(box(page)).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  return cdp;
}

/** The window's frames, by requestAnimationFrame, from now until `stop`. */
async function framesFrom(page: Page): Promise<() => Promise<number[]>> {
  await page.evaluate(() => {
    const frames: number[] = [];
    (window as unknown as { frames_: number[] }).frames_ = frames;
    const tick = (now: number) => {
      frames.push(now);
      if ((window as unknown as { frames_?: number[] }).frames_ === frames)
        requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  return () =>
    page.evaluate(() => {
      const w = window as unknown as { frames_?: number[] };
      const frames = w.frames_ ?? [];
      w.frames_ = undefined;
      return frames.slice(1).map((at, i) => at - (frames[i] as number));
    });
}

/**
 * A finger on the page's right edge drawn slowly leftward and held, traced:
 * `moves` moves of 2 px, the first `settle` of them (the curl's bands made
 * and drawn) apart from the rest. The time spent rasterising, and the
 * frames' times, while the rest moved.
 */
async function heldDrag(page: Page, browser: Browser, cdp: CDPSession, settle = 12, moves = 60) {
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const [x, y] = [rect.x + rect.width * 0.9, rect.y + rect.height * 0.6];
  const move = (step: number) =>
    cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touchAt(x - step * 2, y - step * 0.5),
    });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(x, y) });
  for (let step = 1; step <= settle; step++) {
    await move(step);
    await page.waitForTimeout(16);
  }
  await expect(page.locator('.turn-curl')).toHaveCount(1);
  // The curl's bands drawn: a frame or two for the compositor to have rasterised them.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await browser.startTracing(page, { categories: ['cc', 'disabled-by-default-devtools.timeline'] });
  const stop = await framesFrom(page);
  for (let step = settle + 1; step <= settle + moves; step++) {
    await move(step);
    await page.waitForTimeout(16);
  }
  const frames = await stop();
  const trace = JSON.parse((await browser.stopTracing()).toString()) as {
    traceEvents: TraceEvent[];
  };
  const rasterised = trace.traceEvents.filter((e) => e.name === 'RasterTask' && e.ph === 'X');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 20_000 });
  const raster = rasterised.reduce((sum, e) => sum + e.dur / 1000, 0);
  return { raster, frames };
}

/** The `p`th of `times`, sorted. */
const percentile = (times: number[], p: number) =>
  [...times].sort((a, b) => a - b)[Math.min(times.length - 1, Math.floor(p * times.length))] ?? 0;

test('a held drag rasterises its page once, and keeps the screen’s pace', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const cdp = await slowPhone(page);
  const { raster, frames } = await heldDrag(page, browser, cdp);
  // Measured over sixty moves: 51–58 ms (the shades' and the paper's tiles coming into sight as
  // the roll moves along them; the page's words never again). Before, every move rasterised the
  // page again: 840–873 ms.
  expect(raster, 'ms rasterising while the page curled').toBeLessThan(250);
  // Measured: p90 16.7 ms; a frame dropped now and then on a loaded machine is no stutter.
  expect(frames.length).toBeGreaterThan(30);
  expect(percentile(frames, 0.9), 'the frames’ times, 90th percentile').toBeLessThan(50);
});
