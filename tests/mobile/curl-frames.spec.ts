// The curl's frames on a phone (#40, the curl made smooth): a Galaxy Z Fold's
// curl stuttered at 90% Interface zoom, its GPU rasterising the page again
// every frame (a clip and a light changed each frame are drawn anew each
// frame), up to 200 ms at a time. Now the curl's bands are drawn as the roll
// reaches them and only moved. Traced in Chromium on the phone's page, the
// CPU four times slower: while a finger holds the page and moves, no tile
// holding the page's words is rasterised again (only the shades' and lights'
// plain ramps, as they come into sight), and the window's frames keep the
// screen's pace.

import { type CDPSession, devices, expect, type Page, test } from '@playwright/test';
import { bookInPages, box, touchAt } from './book-hand';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

/** A trace's raster task, as far as these use. */
interface TraceEvent {
  readonly name: string;
  readonly ph: string;
  readonly args?: { readonly tileData?: { readonly layerId: number } };
}

/** The layers over the page's words that are only ever a ramp of ink: rasterised as they come into sight. */
const RAMPS = 'turn-curl__over';

/** The book at the owner's 90% Interface zoom, in pages, the CPU four times slower. */
async function slowPhone(page: Page): Promise<CDPSession> {
  await bookInPages(page);
  await page.evaluate(() => window.eien.settings.set('window.zoom', 90));
  await expect(box(page)).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('DOM.getDocument', { depth: 0 });
  return cdp;
}

/** The window's frames, by requestAnimationFrame, from now until the function returned is called. */
async function framesFrom(page: Page): Promise<() => Promise<number[]>> {
  await page.evaluate(() => {
    const frames: number[] = [];
    (window as unknown as { frames_?: number[] }).frames_ = frames;
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

/** The page's composited layers, each by its element's classes, as told after `change`. */
async function layerNames(
  cdp: CDPSession,
  change: () => Promise<void>,
): Promise<Map<string, string>> {
  const told = new Promise<{ layers?: { layerId: string; backendNodeId?: number }[] }>((done) =>
    cdp.once('LayerTree.layerTreeDidChange', done),
  );
  await cdp.send('LayerTree.enable');
  await change();
  const names = new Map<string, string>();
  for (const layer of (await told).layers ?? []) {
    let name = '';
    if (layer.backendNodeId) {
      const { node } = await cdp.send('DOM.describeNode', { backendNodeId: layer.backendNodeId });
      const attributes = node.attributes ?? [];
      const at = attributes.indexOf('class');
      name = at >= 0 ? (attributes[at + 1] ?? '') : node.nodeName;
    }
    names.set(layer.layerId, name);
  }
  await cdp.send('LayerTree.disable');
  return names;
}

/**
 * A finger on the page's right edge drawn slowly leftward and held: `settle`
 * moves of 2 px as it takes the page (the curl's bands made), then `moves`
 * more, traced. The tiles rasterised as it went on, by their layers'
 * elements, and the frames' times.
 */
async function heldDrag(page: Page, cdp: CDPSession, settle = 12, moves = 60) {
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const [x, y] = [rect.x + rect.width * 0.9, rect.y + rect.height * 0.6];
  let step = 0;
  const move = async () => {
    step++;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touchAt(x - step * 2, y - step * 0.5),
    });
    await page.waitForTimeout(16);
  };
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(x, y) });
  while (step < settle) await move();
  await expect(page.locator('.turn-curl')).toHaveCount(1);
  // A frame or two for the compositor to have rasterised what the bands first show.
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  const browser = page.context().browser();
  if (!browser) throw new Error('no browser');
  await browser.startTracing(page, { categories: ['cc', 'disabled-by-default-devtools.timeline'] });
  const stop = await framesFrom(page);
  while (step < settle + moves) await move();
  const frames = await stop();
  const trace = JSON.parse((await browser.stopTracing()).toString()) as {
    traceEvents: TraceEvent[];
  };
  // Named while the curl's layers are all still there: told as the finger moves once more.
  const names = await layerNames(cdp, move);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 20_000 });
  const tiles = new Map<string, number>();
  for (const event of trace.traceEvents) {
    const layer = event.args?.tileData?.layerId;
    if (event.name !== 'RasterTask' || event.ph !== 'X' || layer === undefined) continue;
    const name = names.get(String(layer)) ?? 'a layer let go';
    tiles.set(name, (tiles.get(name) ?? 0) + 1);
  }
  return { tiles, frames };
}

/** The `p`th of `times`, sorted. */
const percentile = (times: number[], p: number) =>
  [...times].sort((a, b) => a - b)[Math.min(times.length - 1, Math.floor(p * times.length))] ?? 0;

test('a held drag never rasterises the page’s words again, and keeps the screen’s pace', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const cdp = await slowPhone(page);
  const { tiles, frames } = await heldDrag(page, cdp);
  // Measured over sixty moves: ~480 tiles, all the shades' and lights' (~0.2 ms each here, a plain
  // ramp); before, the curl's one layer, its fourteen copies of the words clipped anew every move.
  const words = [...tiles].filter(([name]) => name !== RAMPS);
  expect(Object.fromEntries(words), 'tiles of words rasterised while the page curled').toEqual({});
  // Measured: p90 16.7 ms; a frame dropped now and then on a loaded machine is no stutter.
  expect(frames.length).toBeGreaterThan(30);
  expect(percentile(frames, 0.9), 'the frames’ times, 90th percentile').toBeLessThan(50);
});
