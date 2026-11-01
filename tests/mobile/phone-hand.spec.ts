// A finger turning a book's page on the phone (#40, Phase 3c), with real
// touches: CDP's Input.dispatchTouchEvent, so the browser's own touch
// handling runs (its implicit pointer capture, touch-action, its cancels),
// which synthetic PointerEvents skip. Motion on, so the hand holds a curl.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type CDPSession, devices, expect, type Page, test } from '@playwright/test';
import { open, putBytesOutside } from './outside';

test.use({ ...devices['Pixel 7'], reducedMotion: 'no-preference' });

const FIXTURE = join(import.meta.dirname, '../fixtures/epub/plain.epub');
const back = (page: Page) => page.locator('.phone-bar__back');
const box = (page: Page) => page.locator('.epub-sheet:not([aria-hidden]) .epub__pages');

/** The first words on the page in sight. */
const firstWords = (page: Page) =>
  box(page).evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const at = document.caretRangeFromPoint(rect.left + 2, rect.top + 4);
    return at?.startContainer.textContent?.slice(at.startOffset, at.startOffset + 30) ?? '';
  });

/** A book open in pages on the phone. */
async function bookInPages(page: Page): Promise<void> {
  await open(page);
  await putBytesOutside(
    page,
    'Eien/Vault/Novels/Pride and Prejudice.epub',
    readFileSync(FIXTURE).toString('base64'),
  );
  await back(page).click();
  await page.locator('.tree-row--epub .tree-row__name', { hasText: 'Pride and Prejudice' }).click();
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.view"] [data-value="pages"]').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.page__leaf--epub')).toHaveAttribute('data-view', 'pages');
}

/**
 * Whether the curl is held under the finger: there, and still between two
 * looks (a curl let go or cancelled flies on, moving every frame).
 */
const held = async (page: Page): Promise<boolean> => {
  const back = page.locator('.turn-curl__back');
  // The last move's frame drawn first: a held curl is drawn once a frame, after the hand moves.
  await page.waitForTimeout(100);
  if ((await back.count()) === 0) return false;
  const before = await back.evaluate((element) => (element as HTMLElement).style.transform);
  await page.waitForTimeout(150);
  if ((await back.count()) === 0) return false;
  return before === (await back.evaluate((element) => (element as HTMLElement).style.transform));
};

const touchAt = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];

/** One finger down at `from`, drawn to `to` in `steps`, and lifted: the browser's own touch. */
async function swipe(
  cdp: CDPSession,
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps: number,
): Promise<void> {
  const point = (x: number, y: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: point(from.x, from.y),
  });
  for (let i = 1; i <= steps; i++) {
    const x = from.x + ((to.x - from.x) * i) / steps;
    const y = from.y + ((to.y - from.y) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x, y) });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('a finger drawn across the words, well inside the screen, turns the page', async ({
  page,
}) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const first = await firstWords(page);
  const cdp = await page.context().newCDPSession(page);
  const y = rect.y + rect.height / 2;
  // From the page's right two-thirds to its left third: on.
  await swipe(cdp, { x: rect.x + rect.width * 0.7, y }, { x: rect.x + rect.width * 0.1, y }, 12);
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  await expect.poll(() => firstWords(page)).not.toBe(first);
});

test('a finger drawn a little holds the page, and lifted slowly lets it fall back, home', async ({
  page,
}) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const first = await firstWords(page);
  const cdp = await page.context().newCDPSession(page);
  const y = rect.y + rect.height / 2;
  const x = rect.x + rect.width * 0.6;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(x, y) });
  for (let i = 1; i <= 30; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touchAt(x - i, y),
    });
  }
  // Still under the finger as it's lifted: never cancelled by the browser on the way.
  expect(await held(page)).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  expect(await firstWords(page)).toBe(first);
});

test('a gesture the system cancels lets the page fall back home, flying', async ({ page }) => {
  await bookInPages(page);
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const first = await firstWords(page);
  const cdp = await page.context().newCDPSession(page);
  const y = rect.y + rect.height / 2;
  const x = rect.x + rect.width * 0.8;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touchAt(x, y) });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: touchAt(x - i * 30, y),
    });
  }
  expect(await held(page)).toBe(true);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  // Home, not snatched away: the curl is still there, flying back, then goes.
  await expect(page.locator('.turn-curl')).toHaveCount(1);
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  expect(await firstWords(page)).toBe(first);
});

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

/**
 * The page's layers watched: `curlDrawn` waits for the curl's to be among them
 * and counts the layers made anew from then; `between` says what happened from
 * that look to now.
 */
async function watchLayers(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.getDocument', { depth: 0 });
  let tree: readonly Layer[] = [];
  let drawing = '';
  let remade = 0;
  cdp.on('LayerTree.layerTreeDidChange', ({ layers }) => {
    if (!layers) return;
    tree = layers;
    const ids = layers
      .filter((layer) => layer.drawsContent)
      .map((layer) => layer.layerId)
      .sort()
      .join();
    if (ids !== drawing) remade++;
    drawing = ids;
  });
  await cdp.send('LayerTree.enable');
  const curlIn = (drawn: Drawn) =>
    [...drawn.values()].some(({ name }) => name.includes('turn-curl'));
  return {
    cdp,
    // The tree is told a frame or more after the page changes, later on a slow machine: the curl's
    // layers counted from the tree that has them, not from the one before.
    curlDrawn: async (): Promise<Drawn> => {
      await expect
        .poll(async () => curlIn(await drawnLayers(cdp, tree)), { intervals: [16] })
        .toBe(true);
      remade = 0;
      return drawnLayers(cdp, tree);
    },
    between: async (before: Drawn): Promise<Turning> => {
      const after = await drawnLayers(cdp, tree);
      const repainted = new Map<string, number>();
      for (const [id, { paints, name }] of after) {
        // A paint or two as it settles is no repaint a move.
        const times = paints - (before.get(id)?.paints ?? 0);
        if (times > 2) repainted.set(name, (repainted.get(name) ?? 0) + times);
      }
      const curl = [...after.values()]
        .map(({ name }) => name)
        .filter((name) => name.includes('turn-curl'));
      return { curl: curl.sort(), repainted, remade };
    },
  };
}

/**
 * A slow finger drawn across the page and held, on (leftward from its right
 * edge) or back (rightward from its left), the layers watched as it moves.
 */
async function layersWhileHeld(page: Page, way: 1 | -1 = 1): Promise<Turning> {
  const rect = await box(page).boundingBox();
  if (!rect) throw new Error('no page');
  const watch = await watchLayers(page);
  const y = rect.y + rect.height * 0.6;
  const x = rect.x + rect.width * (way > 0 ? 0.9 : 0.1);
  let step = 0;
  const moves = async (count: number) => {
    for (let i = 0; i < count; i++) {
      step++;
      // Slowly, and never quite straight: a finger's way.
      await watch.cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: touchAt(x - way * step * 2, y + (step % 2)),
      });
      await page.waitForTimeout(16);
    }
  };
  await watch.cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: touchAt(x, y),
  });
  await moves(10);
  await expect(page.locator('.turn-curl')).toHaveCount(1);
  const before = await watch.curlDrawn();
  await moves(40);
  const turning = await watch.between(before);
  await watch.cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('.turn-curl')).toHaveCount(0);
  return turning;
}

/** A key's turn, flying at the slowest Turn speed, the layers watched in flight. */
async function layersInFlight(page: Page, key: string): Promise<Turning> {
  const watch = await watchLayers(page);
  await page.keyboard.press(key);
  const before = await watch.curlDrawn();
  // Well inside the flight, which takes over a second at four times slower.
  await page.waitForTimeout(500);
  const turning = await watch.between(before);
  await expect(page.locator('.turn-curl')).toHaveCount(0, { timeout: 10_000 });
  return turning;
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

// Backlog #55: a slow drag flickered a phone's whole screen once each of the
// curl's pieces was a layer of its own (#144): a piece's clip, new every
// frame, is painted in its layer, so every move made its layers anew and
// repainted them, and the window beneath too. A move repaints the turning
// page alone, its layers the same throughout.
test('a slow drag repaints the turning page alone', async ({ page }) => {
  await bookInPages(page);
  const { curl, repainted, remade } = await layersWhileHeld(page);
  expect(curl).toEqual(['turn-curl']);
  expect([...repainted.keys()]).toEqual(['turn-curl']);
  expect(repainted.get('turn-curl')).toBeGreaterThan(10);
  expect(remade).toBeLessThanOrEqual(1);
});

// Back, the page before is a piece beneath the curl and the sheet hidden: in
// the turning page's layer too, never one of its own.
test('a slow drag back repaints the turning page alone, the page beneath in it', async ({
  page,
}) => {
  await bookInPages(page);
  await turnedOn(page);
  const { curl, repainted, remade } = await layersWhileHeld(page, -1);
  expect(curl).toEqual(['turn-curl']);
  expect([...repainted.keys()]).toEqual(['turn-curl']);
  expect(repainted.get('turn-curl')).toBeGreaterThan(10);
  expect(remade).toBeLessThanOrEqual(1);
});

test('a slow drag on two facing pages repaints the turning page alone, the other lying still', async ({
  page,
}) => {
  await bookOnTwoPages(page);
  const { curl, repainted, remade } = await layersWhileHeld(page);
  expect(curl).toEqual(['turn-curl__leaf', 'turn-curl__piece turn-curl__still']);
  expect([...repainted.keys()]).toEqual(['turn-curl__leaf']);
  expect(repainted.get('turn-curl__leaf')).toBeGreaterThan(10);
  expect(remade).toBeLessThanOrEqual(1);
});

// Back on two pages the left page turns, its leaf mirrored: one layer still.
test('a slow drag back on two facing pages repaints the left page alone, mirrored', async ({
  page,
}) => {
  await bookOnTwoPages(page);
  await turnedOn(page);
  const { curl, repainted, remade } = await layersWhileHeld(page, -1);
  expect(curl).toEqual(['turn-curl__leaf', 'turn-curl__piece turn-curl__still']);
  expect([...repainted.keys()]).toEqual(['turn-curl__leaf']);
  expect(repainted.get('turn-curl__leaf')).toBeGreaterThan(10);
  expect(remade).toBeLessThanOrEqual(1);
});

// A key's (or a tap's) turn flies by the same pieces as a drag, for a moment
// rather than seconds: its layers the same throughout too.
test('a key’s turn flies with the turning page alone repainting', async ({ page }) => {
  await bookInPages(page);
  await page.locator('.phone-bar__controls [data-command="look"]').click();
  await page.locator('[data-setting="epub.turnSpeed"] [data-value="4"]').click();
  await page.keyboard.press('Escape');
  await page.locator('.page__leaf--epub .page__scroll').focus();
  const { curl, repainted, remade } = await layersInFlight(page, 'ArrowRight');
  expect(curl).toEqual(['turn-curl']);
  expect([...repainted.keys()]).toEqual(['turn-curl']);
  expect(repainted.get('turn-curl')).toBeGreaterThan(10);
  expect(remade).toBeLessThanOrEqual(1);
});
