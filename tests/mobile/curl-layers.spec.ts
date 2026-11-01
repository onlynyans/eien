// The curl's layers while a book's page turns on the phone (backlog #55, then
// the curl made smooth): a slow drag flickered a phone's whole screen once
// each of the curl's pieces was a layer of its own (#144), and once they were
// one layer, it stuttered: a piece's clip and light, new every frame, were
// painted in its layer, so every frame painted the whole page again. Now each
// piece is a band drawn once and only moved. Watched through CDP's LayerTree,
// under real touches (CDP's Input.dispatchTouchEvent): while a page curls,
// no layer is painted again, and none made anew.

import { readFileSync } from 'node:fs';
import { type CDPSession, devices, expect, type Page, test } from '@playwright/test';
import { bookInPages, box, FIXTURE, firstWords, touchAt } from './book-hand';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

/** The page lying still on two facing pages: a layer of its own, painted once. */
const STILL = 'turn-curl__under turn-curl__still';

/** What a composited layer's snapshot says of it (CDP's LayerTree.Layer), as far as these use. */
interface Layer {
  readonly layerId: string;
  readonly drawsContent: boolean;
  readonly paintCount: number;
  readonly backendNodeId?: number;
}

type Drawn = Map<string, { paints: number; name: string }>;

/** The composited layers that draw, by id, each with its paint count and its element's classes. */
async function drawnLayers(cdp: CDPSession, layers: readonly Layer[]): Promise<Drawn> {
  const drawn: Drawn = new Map();
  for (const layer of layers) {
    if (!layer.drawsContent) continue;
    let name = '';
    if (layer.backendNodeId) {
      const { node } = await cdp.send('DOM.describeNode', { backendNodeId: layer.backendNodeId });
      const attributes = node.attributes ?? [];
      const at = attributes.indexOf('class');
      name = at >= 0 ? (attributes[at + 1] ?? '') : node.nodeName;
    }
    drawn.set(layer.layerId, { paints: layer.paintCount, name });
  }
  return drawn;
}

/**
 * What the layers did while a page turned: the curl's, by their elements'
 * classes; which repainted, and how often; how often the layers that draw were
 * made anew.
 */
interface Turning {
  readonly curl: string[];
  readonly repainted: Map<string, number>;
  readonly remade: number;
}

/** A tree's layers that draw, their ids joined: a change in it is a layer made anew or let go. */
const drawingIds = (layers: readonly Layer[]) =>
  layers
    .filter((layer) => layer.drawsContent)
    .map((layer) => layer.layerId)
    .sort()
    .join();

/**
 * The page's layers watched, every tree the compositor tells (one a frame
 * drawn) kept in order: `settled` waits for the page to stop changing (a
 * picture or a font drawn), `curlDrawn` for a tree with the curl's layers in
 * it, `drawn` counts the trees told since, and `between` says what happened
 * from that tree to the turn's last, so a turn that lands is read whole.
 * Counted in frames drawn, never in time: a loaded machine draws fewer frames
 * a second, and the turn is judged by those it drew.
 */
async function watchLayers(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.getDocument', { depth: 0 });
  const trees: (readonly Layer[])[] = [];
  let told = 0;
  cdp.on('LayerTree.layerTreeDidChange', ({ layers }) => {
    if (!layers) return;
    trees.push(layers);
    told = Date.now();
  });
  await cdp.send('LayerTree.enable');
  /** The tree the curl was first seen in, by its place in `trees`, and its layers. */
  let first = -1;
  let before: Drawn = new Map();
  return {
    cdp,
    // No new tree for a while: what the page was still drawing is drawn, and isn't the turn's.
    settled: () => expect.poll(() => Date.now() - told, { intervals: [50] }).toBeGreaterThan(250),
    // The tree is told a frame or more after the page changes, later on a slow machine: the curl's
    // layers counted from the tree that has them, not from the one before.
    curlDrawn: async (): Promise<void> => {
      await expect
        .poll(
          async () => {
            first = trees.length - 1;
            before = await drawnLayers(cdp, trees[first] ?? []);
            return [...before.values()].some(({ name }) => name.includes('turn-curl'));
          },
          { intervals: [16] },
        )
        .toBe(true);
    },
    drawn: () => trees.length - 1 - first,
    between: async (): Promise<Turning> => {
      // The turn's layers: the curl's, and any made while one of them still drew (the page's own
      // are the first tree's others). The turn ends with the first tree that has none of them.
      const curlIds = [...before].filter(([, { name }]) => name.includes('turn-curl'));
      const base = new Set(
        [...before.keys()].filter((id) => !curlIds.some(([curl]) => curl === id)),
      );
      const newIn = (layers: readonly Layer[]) =>
        layers.filter((layer) => layer.drawsContent && !base.has(layer.layerId));
      const turns = new Set(curlIds.map(([id]) => id));
      // Each of the turn's layers as first and last seen drawing: one shown only once the page has
      // lifted (a strip, a shadow, the flap) is held from then on, as the first tree's are.
      const seen = new Map<string, { from: Layer; to: Layer }>();
      for (const layer of trees[first] ?? []) {
        if (turns.has(layer.layerId)) seen.set(layer.layerId, { from: layer, to: layer });
      }
      let last = first;
      for (let i = first + 1; i < trees.length; i++) {
        const made = newIn(trees[i] ?? []);
        if (!made.some((layer) => turns.has(layer.layerId))) break;
        for (const layer of made) {
          turns.add(layer.layerId);
          const was = seen.get(layer.layerId);
          seen.set(layer.layerId, { from: was?.from ?? layer, to: layer });
        }
        last = i;
      }
      let remade = 0;
      for (let i = first + 1; i <= last; i++) {
        if (drawingIds(trees[i] ?? []) !== drawingIds(trees[i - 1] ?? [])) remade++;
      }
      const repainted = new Map<string, number>();
      for (const [id, { from, to }] of seen) {
        // A paint or two as it settles is no repaint a move.
        const times = to.paintCount - from.paintCount;
        if (times <= 2) continue;
        const name = before.get(id)?.name ?? (await drawnLayers(cdp, [to])).get(id)?.name ?? id;
        repainted.set(name, (repainted.get(name) ?? 0) + times);
      }
      const curl = curlIds.map(([, { name }]) => name).sort();
      return { curl, repainted, remade };
    },
  };
}

/** The frames a turn is judged over: enough for a repaint each to be told from a stray one. */
const FRAMES = 30;

/**
 * A slow finger drawn across the page and held, on (leftward from its right
 * edge) or back (rightward from its left), the layers watched as it moves,
 * until the window has drawn `FRAMES` frames of it.
 */
async function layersWhileHeld(page: Page, way: 1 | -1 = 1): Promise<Turning> {
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const watch = await watchLayers(page);
  const y = rect.y + rect.height * 0.6;
  const x = rect.x + rect.width * (way > 0 ? 0.9 : 0.1);
  let step = 0;
  const move = async () => {
    step++;
    // Slowly, and never quite straight: a finger's way.
    await watch.cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touchAt(x - way * step * 2, y + (step % 2)),
    });
    await page.waitForTimeout(16);
  };
  await watch.settled();
  await watch.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: touchAt(x, y),
  });
  for (let i = 0; i < 10; i++) await move();
  await watch.curlDrawn();
  // Two pixels a move, to at most 70% of the page's width: a slow drag still.
  while (watch.drawn() < FRAMES && step < rect.width * 0.35) await move();
  const turning = await watch.between();
  await watch.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  return turning;
}

/**
 * The window's clock made the frames': a frame's time for each frame drawn,
 * however long a loaded machine took to draw it. A turn in flight is timed by
 * the clock (src/ui/epub/turn/next-frame.ts), and where frames stall it
 * lands by a timer behind them, so on a slow machine it could land with a
 * frame or two drawn; by this clock it lasts as many frames on any machine.
 */
const frameClock = (page: Page) =>
  page.evaluate(() => {
    let now = performance.now();
    const tick = () => {
      now += 1000 / 60;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    performance.now = () => now;
  });

/** A key's turn, flying at the slowest Turn speed, the layers watched from its first frame to landing. */
async function layersInFlight(page: Page, key: string): Promise<Turning> {
  const watch = await watchLayers(page);
  await watch.settled();
  await frameClock(page);
  await page.keyboard.press(key);
  await watch.curlDrawn();
  await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 20_000 });
  expect(watch.drawn()).toBeGreaterThanOrEqual(FRAMES);
  return await watch.between();
}

/** A page turned on by a key, and landed: a page before it to turn back to. */
async function turnedOn(page: Page): Promise<void> {
  await page.locator('.page__leaf--epub .page__scroll').focus();
  const first = await firstWords(page);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(() => firstWords(page)).not.toBe(first);
}

/** A book in pages on two facing pages, the desktop's panes on a wide screen. */
async function bookOnTwoPages(page: Page): Promise<void> {
  await open(page);
  await page.evaluate(async () => {
    await window.eien.settings.set('appearance.room', 'panes');
    await window.eien.settings.set('epub.view', 'pages');
    await window.eien.settings.set('epub.turn', 'curl');
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
}

/**
 * The curl's pages layers of their own (and `still`, a spread's page lying
 * still), none painted again while the page curls, and made anew at most as
 * the roll's strips come (a crease rounding) and go (landing flat).
 */
function expectOnlyMoved({ curl, repainted, remade }: Turning, still = false): void {
  expect(curl).toContain('turn-curl__inside');
  expect(curl.includes(STILL)).toBe(still);
  expect(Object.fromEntries(repainted)).toEqual({});
  expect(remade).toBeLessThanOrEqual(2);
}

test('a slow drag repaints nothing: the curl only moves', async ({ page }) => {
  await bookInPages(page);
  expectOnlyMoved(await layersWhileHeld(page));
});

// Back, the page before lies beneath the curl and the sheet is hidden: painted once.
test('a slow drag back repaints nothing, the page beneath painted once', async ({ page }) => {
  await bookInPages(page);
  await turnedOn(page);
  expectOnlyMoved(await layersWhileHeld(page, -1));
});

test('a slow drag on two facing pages repaints nothing, the other page lying still', async ({
  page,
}) => {
  await bookOnTwoPages(page);
  expectOnlyMoved(await layersWhileHeld(page), true);
});

// Back on two pages the left page turns, its leaf mirrored.
test('a slow drag back on two facing pages repaints nothing, mirrored', async ({ page }) => {
  await bookOnTwoPages(page);
  await turnedOn(page);
  expectOnlyMoved(await layersWhileHeld(page, -1), true);
});

// A key's (or a tap's) turn flies by the same bands as a drag, for a moment
// rather than seconds: nothing repainted there either.
test('a key’s turn flies repainting nothing', async ({ page }) => {
  await bookInPages(page);
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.turnSpeed"] [data-value="4"]').click();
  await page.keyboard.press('Escape');
  // Kept before the turn: a setting that changes lands a turn in flight, and on a loaded machine
  // the store took long enough to land this one a frame into it.
  await expect
    .poll(() => page.evaluate(async () => (await window.eien.settings.read())['epub.turnSpeed']))
    .toBe('4');
  await page.locator('.page__leaf--epub .page__scroll').focus();
  expectOnlyMoved(await layersInFlight(page, 'ArrowRight'));
});
