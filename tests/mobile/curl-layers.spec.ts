// The curl's layers while a book's page turns on the phone (backlog #55): a
// slow drag flickered a phone's whole screen once each of the curl's pieces
// was a layer of its own (#144). A piece's clip, new every frame, is painted
// in its layer, so every move made its layers anew and repainted them, and
// the window beneath too. Watched through CDP's LayerTree, under real touches
// (CDP's Input.dispatchTouchEvent): a move repaints the turning page alone,
// its layers the same throughout.

import { readFileSync } from 'node:fs';
import { type CDPSession, devices, expect, type Page, test } from '@playwright/test';
import { bookInPages, box, FIXTURE, firstWords, touchAt } from './book-hand';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

/** The curl's layers on one page: the curl alone. */
const ONE = ['turn-curl'];
/** On two facing pages: the turning page, and the one lying still. */
const TWO = ['turn-curl__leaf', 'turn-curl__piece turn-curl__still'];

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
    between: (): Turning => {
      // The turn's layers: the curl's, and any made while one of them still drew (the page's own
      // are the first tree's others). The turn ends with the first tree that has none of them.
      const curlIds = [...before].filter(([, { name }]) => name.includes('turn-curl'));
      const base = new Set(
        [...before.keys()].filter((id) => !curlIds.some(([curl]) => curl === id)),
      );
      const newIn = (layers: readonly Layer[]) =>
        layers.filter((layer) => layer.drawsContent && !base.has(layer.layerId));
      const turns = new Set(curlIds.map(([id]) => id));
      let last = first;
      for (let i = first + 1; i < trees.length; i++) {
        const made = newIn(trees[i] ?? []);
        if (!made.some((layer) => turns.has(layer.layerId))) break;
        for (const layer of made) turns.add(layer.layerId);
        last = i;
      }
      let remade = 0;
      for (let i = first + 1; i <= last; i++) {
        if (drawingIds(trees[i] ?? []) !== drawingIds(trees[i - 1] ?? [])) remade++;
      }
      const repainted = new Map<string, number>();
      for (const layer of trees[last] ?? []) {
        const was = before.get(layer.layerId);
        if (!was) continue;
        // A paint or two as it settles is no repaint a move.
        const times = layer.paintCount - was.paints;
        if (times > 2) repainted.set(was.name, (repainted.get(was.name) ?? 0) + times);
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
  const turning = watch.between();
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
  return watch.between();
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
 * The curl's layers `curl` throughout, and `turning` (its turning page's) the
 * only one repainted, again and again, never made anew.
 */
function expectAlone(
  { curl, repainted, remade }: Turning,
  layers: string[],
  turning: string,
): void {
  expect(curl).toEqual(layers);
  expect([...repainted.keys()]).toEqual([turning]);
  expect(repainted.get(turning)).toBeGreaterThan(10);
  expect(remade).toBeLessThanOrEqual(1);
}

test('a slow drag repaints the turning page alone', async ({ page }) => {
  await bookInPages(page);
  expectAlone(await layersWhileHeld(page), ONE, 'turn-curl');
});

// Back, the page before is a piece beneath the curl and the sheet hidden: in
// the turning page's layer too, never one of its own.
test('a slow drag back repaints the turning page alone, the page beneath in it', async ({
  page,
}) => {
  await bookInPages(page);
  await turnedOn(page);
  expectAlone(await layersWhileHeld(page, -1), ONE, 'turn-curl');
});

test('a slow drag on two facing pages repaints the turning page alone, the other lying still', async ({
  page,
}) => {
  await bookOnTwoPages(page);
  expectAlone(await layersWhileHeld(page), TWO, 'turn-curl__leaf');
});

// Back on two pages the left page turns, its leaf mirrored: one layer still.
test('a slow drag back on two facing pages repaints the left page alone, mirrored', async ({
  page,
}) => {
  await bookOnTwoPages(page);
  await turnedOn(page);
  expectAlone(await layersWhileHeld(page, -1), TWO, 'turn-curl__leaf');
});

// A key's (or a tap's) turn flies by the same pieces as a drag, for a moment
// rather than seconds: its layers the same throughout too.
test('a key’s turn flies with the turning page alone repainting', async ({ page }) => {
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
  expectAlone(await layersInFlight(page, 'ArrowRight'), ONE, 'turn-curl');
});
