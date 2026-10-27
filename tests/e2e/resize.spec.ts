// A steady top bar while the window resizes (backlog #44): each step of a
// resize draws every control of the window's top bands where it will stay, in
// every layout and in the split, never drawn somewhere and then moved, and the
// controls are the same ones throughout, never made again.

import type { ElectronApplication, Page } from '@playwright/test';
import { clickMenu, expect, test } from './launch';

test.use({ vaultFiles: { 'Chapter.md': 'The gate held.\n', 'Notes.md': 'Snow on the walls.\n' } });

type Layout = 'band' | 'slip' | 'runhead';
const LAYOUTS: readonly Layout[] = ['band', 'slip', 'runhead'];

/** The top bands' controls: the sidebar's head (the seal), the page's bar, C's running head. */
const CONTROLS = ':is(.sidebar__head, .page__bar, .window-head) button';
/** Frames drawn after each step: a slide (--eien-calm, 220 ms) or a corner put back shows in them. */
const FRAMES = 10;

/** Narrower in steps, through where the panes squeeze the list (under 940 px), and back. */
const steps = (from: number, to: number, by: number): number[] => {
  const down: number[] = [];
  for (let width = from; width >= to; width -= by) down.push(width);
  return [...down, ...down.slice(0, -1).reverse()];
};

/**
 * Where each control is in each of the next `frames` frames, read once the
 * frame is painted (a task posted from its animation frame runs after it);
 * and, by name, each control drawn as a new element where another was.
 */
const framesOfControls = (page: Page, frames: number) =>
  page.evaluate(
    ({ selector, frames }) =>
      new Promise<{ width: number; at: Record<string, string>; remade: string[] }[]>((resolve) => {
        const seen: { width: number; at: Record<string, string>; remade: string[] }[] = [];
        const held = window as { steadyKnown?: Map<string, HTMLElement> };
        held.steadyKnown ??= new Map();
        const known = held.steadyKnown;
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          const at: Record<string, string> = {};
          const remade: string[] = [];
          for (const control of document.querySelectorAll<HTMLElement>(selector)) {
            if (!control.checkVisibility()) continue;
            const box = control.getBoundingClientRect();
            // The pager's two buttons may name one note: each by its place among its namesakes.
            let name = control.dataset.key ?? control.textContent ?? '?';
            while (name in at) name += "'";
            at[name] = `${Math.round(box.left)},${Math.round(box.top)} ${Math.round(box.width)}`;
            if ((known.get(name) ?? control) !== control) remade.push(name);
            known.set(name, control);
          }
          seen.push({ width: innerWidth, at, remade });
          if (seen.length < frames) requestAnimationFrame(() => channel.port2.postMessage(0));
          else resolve(seen);
        };
        requestAnimationFrame(() => channel.port2.postMessage(0));
      }),
    { selector: CONTROLS, frames },
  );

/** Resize the window's page to `width`, and wait until the page has it. */
async function resizeTo(app: ElectronApplication, page: Page, width: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, width) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error('No window');
    window.setContentSize(width, 800);
  }, width);
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(width);
}

/** Step the window through `widths`: at each, every control stays where its first frame drew it. */
async function resizeSteadily(
  app: ElectronApplication,
  page: Page,
  widths: readonly number[],
): Promise<void> {
  for (const width of widths) {
    await resizeTo(app, page, width);
    const [first, ...rest] = await framesOfControls(page, FRAMES);
    expect(Object.keys(first?.at ?? {}).length).toBeGreaterThan(5);
    for (const frame of [first, ...rest]) {
      expect(frame?.remade, `at ${width} px, controls made again`).toEqual([]);
    }
    for (const frame of rest) {
      expect(frame.width, 'the window changed size while it was held').toBe(width);
      expect(frame.at, `at ${width} px, a control moved after it was drawn`).toEqual(first?.at);
    }
  }
}

for (const layout of LAYOUTS) {
  test.describe(`${layout}`, () => {
    test.use({ deviceFile: { settings: { 'appearance.layout': layout } } });

    test('the top bar holds still as the window resizes', async ({ app, page }) => {
      await page.locator('.note-row', { hasText: 'Chapter' }).click();
      await expect(page.locator('.cm-content')).toContainText('The gate held.');
      await resizeSteadily(app, page, steps(1400, 820, 40));
    });

    test('split, the top bar holds still as the window resizes', async ({ app, page }) => {
      await page.locator('.note-row', { hasText: 'Chapter' }).click();
      await expect(page.locator('.cm-content')).toContainText('The gate held.');
      await clickMenu(app, 'View', 'Split Page');
      await expect(page.locator('.page__pages > .page__leaf')).toHaveCount(2);
      // Through where the two pages fold into one (under 720 px of pane) and back.
      await resizeSteadily(app, page, steps(1600, 1000, 40));
    });
  });
}
