// Tools that don't fit their bar fold behind a ⋯ (./fold.ts): which fold, in
// what order, what the ⋯ offers, and where the keyboard goes. happy-dom lays
// nothing out, so a bar's room is counted in controls here: each button in
// sight takes one, the ⋯ too.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Chrome, type ChromeOf } from './chrome';
import { actsOn, type CommandId } from './commands';
import { contentBox, folded, within } from './fold';
import type { SlotName } from './layout-spec';
import { FORMAT_FOLDS } from './layout-spec';

const SLOTS: readonly SlotName[] = [
  'top',
  'pageBar',
  'format',
  'sidebarChevron',
  'listChevron',
  'foot',
  'phoneBar',
  'phoneFoot',
];

let room: number;
let slots: Record<SlotName, HTMLElement>;
let of: ChromeOf;
let chrome: Chrome;

/** Out of the row: folded, or set aside (a book's own tools, on a note's page). */
const out = (button: HTMLElement) => button.hidden || button.hasAttribute('data-aside');
const inSight = (bar: HTMLElement) =>
  [...bar.querySelectorAll('button')].filter((button) => !out(button)).length;
const bar = () => slots.pageBar;
const shown = (within = bar()) =>
  [...within.querySelectorAll<HTMLElement>('[data-command]')]
    .filter((button) => !out(button))
    .map((button) => button.dataset.command);
const mores = () => [...bar().querySelectorAll<HTMLButtonElement>('.host__more')];
const more = () => mores().find((button) => !button.hidden);
const menuItems = () =>
  [...document.querySelectorAll('.menu [role^="menuitem"]')].map((item) =>
    item.textContent?.trim(),
  );

beforeEach(() => {
  room = 20;
  slots = Object.fromEntries(
    SLOTS.map((name) => [name, document.createElement('div')]),
  ) as unknown as Record<SlotName, HTMLElement>;
  // Drawn: a bar with no client rects is one the window doesn't show.
  for (const slot of SLOTS) slots[slot].getClientRects = () => [new DOMRect()] as never;
  document.body.replaceChildren(...SLOTS.map((name) => slots[name]));
  of = {
    mac: true,
    slots,
    // A note's page: a book's own tools set aside, as the window sets them (../vault/command-looks.ts).
    look: (id) =>
      !actsOn(id, 'note')
        ? { aside: true }
        : id === 'focus'
          ? { pressed: true }
          : id.startsWith('view.')
            ? { pressed: id === 'view.live' }
            : {},
    send: vi.fn(),
    local: vi.fn(),
    lost: vi.fn(),
    watch: vi.fn(),
    fits: (_host, bar) => inSight(bar) <= room,
  };
  chrome = new Chrome(of);
});
afterEach(() => {
  chrome.unmount();
  document.body.replaceChildren();
});

const fitTo = (controls: number) => {
  room = controls;
  chrome.fit();
};

describe('folded', () => {
  it('folds the fewest, first first, and all when nothing less fits', () => {
    expect(folded(['a', 'b', 'c'], (ids) => ids.length >= 2)).toEqual(['a', 'b']);
    expect(folded(['a', 'b'], () => true)).toEqual([]);
    expect(folded(['a', 'b'], () => false)).toEqual(['a', 'b']);
  });
});

describe('A · Band’s bar', () => {
  beforeEach(() => chrome.mount('band'));

  it('with room for every tool, folds none, and has no ⋯', () => {
    expect(chrome.folded(bar())).toEqual([]);
    expect(more()).toBeUndefined();
    expect(shown()).toEqual([
      'view.live',
      'view.source',
      'view.reading',
      'compare',
      'seal',
      'versions',
      'format-bar',
      'focus',
      'look',
      'strip',
    ]);
  });

  it('folds the least asked for first, behind one ⋯ at the bar’s end', () => {
    fitTo(9); // three views, four tools, the strip and the ⋯
    expect(chrome.folded(bar())).toEqual(['compare', 'versions']);
    expect(mores().filter((button) => !button.hidden)).toHaveLength(1);
    expect(bar().lastElementChild?.contains(more() ?? null)).toBe(true);
  });

  it('folds the views as one, late, and the seal last; never the strip, the shut band’s way back', () => {
    fitTo(3); // seal, strip, ⋯: the views folded whole
    expect(shown()).toEqual(['seal', 'strip']);
    fitTo(1);
    expect(shown()).toEqual(['strip']);
    expect(chrome.folded(bar())).toEqual([
      'view.live',
      'view.source',
      'view.reading',
      'compare',
      'seal',
      'versions',
      'format-bar',
      'focus',
      'look',
    ]);
  });

  it('folds the look last of the tools, before the views (#49)', () => {
    fitTo(6); // three views, seal, strip, ⋯
    expect(chrome.folded(bar())).toEqual(['compare', 'versions', 'format-bar', 'focus', 'look']);
    fitTo(7); // the look in sight still
    expect(shown()).toEqual(['view.live', 'view.source', 'view.reading', 'seal', 'look', 'strip']);
  });

  it('unfolds when the bar has room again', () => {
    fitTo(5);
    fitTo(20);
    expect(chrome.folded(bar())).toEqual([]);
    expect(more()).toBeUndefined();
  });

  it('hides a rule with no tool in sight on one side of it', () => {
    const [rule, last] = bar().querySelectorAll<HTMLElement>('.host__rule');
    // compare seal versions | format-bar focus | look strip
    expect([rule?.hidden, last?.hidden]).toEqual([false, false]);
    fitTo(8); // views, seal | focus | look strip ⋯: versions, compare, format-bar folded
    expect([rule?.hidden, last?.hidden]).toEqual([false, false]);
    fitTo(7); // views, seal | look strip ⋯: focus folded, the run between gone with its rule
    expect([rule?.hidden, last?.hidden]).toEqual([false, true]);
    fitTo(3); // seal | strip ⋯: a run on each side still
    expect([rule?.hidden, last?.hidden]).toEqual([false, true]);
    fitTo(1); // the strip alone: no tool before a rule
    expect([rule?.hidden, last?.hidden]).toEqual([true, true]);
  });

  it('leaves a bar the window doesn’t draw as it is (a phone’s)', () => {
    fitTo(5);
    const before = chrome.folded(bar());
    bar().getClientRects = () => [] as never;
    fitTo(20);
    expect(chrome.folded(bar())).toEqual(before);
  });
});

describe('the ⋯', () => {
  beforeEach(() => chrome.mount('band'));

  it('offers what folded in the bar’s order, as on or off as its button, and runs it', () => {
    fitTo(3);
    more()?.click();
    expect(menuItems()).toEqual([
      'Live',
      'Source',
      'Reading',
      'Compare',
      'Versions',
      'Formatting bar',
      'Focus mode',
      'Look',
    ]);
    const checked = [...document.querySelectorAll('.menu [aria-checked="true"]')].map(
      (item) => `${item.textContent?.trim()} ${item.getAttribute('role')}`,
    );
    // The views one choice, with the dot; Focus mode on or off by itself.
    expect(checked).toEqual(['Live menuitemradio', 'Focus mode menuitemcheckbox']);
    const compare = [...document.querySelectorAll<HTMLElement>('.menu [role^="menuitem"]')].find(
      (item) => item.textContent?.trim() === 'Compare',
    );
    compare?.click();
    expect(of.send).toHaveBeenCalledWith('compare', 'compare' satisfies CommandId);
  });

  it('takes the keyboard from a tool that folds', () => {
    chrome.buttons('versions')[0]?.focus();
    fitTo(8);
    expect(document.activeElement).toBe(more());
  });

  it('is reached by the toolbar’s arrows', () => {
    fitTo(8);
    const strip = chrome.buttons('strip')[0];
    strip?.focus();
    strip?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(document.activeElement).toBe(more());
  });
});

describe('B · Slip and C · Running head', () => {
  it('fold their page tools too, never the slip’s strip', () => {
    for (const layout of ['slip', 'runhead'] as const) {
      chrome.mount(layout);
      const tools = layout === 'slip' ? bar() : slots.top;
      room = 4;
      chrome.fit();
      expect(chrome.folded(tools).length, layout).toBeGreaterThan(0);
      expect(inSight(tools), layout).toBeLessThanOrEqual(4);
      if (layout === 'slip') expect(shown()).toContain('strip');
      chrome.unmount();
    }
  });
});

describe('A · Band’s formatting row', () => {
  it('folds from its end, bold and italic staying', () => {
    expect(FORMAT_FOLDS.at(0)).toBe('format.table');
    expect(FORMAT_FOLDS).not.toContain('format.bold');
    expect(FORMAT_FOLDS).not.toContain('format.italic');
    chrome.mount('band');
    room = 4; // bold, italic, underline and the ⋯
    chrome.fit();
    expect(shown(slots.format)).toEqual(['format.bold', 'format.italic', 'format.underline']);
    expect(chrome.folded(slots.format)).toHaveLength(FORMAT_FOLDS.length - 1);
  });
});

describe('a press', () => {
  it('fits the bar again after the strip, which changes the slip’s room with no resize', async () => {
    chrome.mount('slip');
    room = 4;
    chrome.fit();
    expect(chrome.folded(bar()).length).toBeGreaterThan(0);
    room = 20;
    chrome.press('strip', chrome.buttons('strip')[0] as HTMLElement);
    await Promise.resolve();
    expect(chrome.folded(bar())).toEqual([]);
  });
});

describe('a layout switch', () => {
  it('keeps the keyboard on the same command, or the ⋯ it’s folded behind', () => {
    chrome.mount('band');
    chrome.buttons('versions')[0]?.focus();
    room = 4; // slip's bar: versions folded there
    chrome.mount('slip');
    expect(document.activeElement).toBe(more());
    expect(of.lost).not.toHaveBeenCalled();
  });
});

describe('within', () => {
  it('is the bar’s content box, inside its border and padding, at both ends', () => {
    const bar = document.createElement('div');
    bar.style.padding = '0 12px';
    bar.style.border = '1px solid';
    bar.getBoundingClientRect = () => new DOMRect(100, 0, 300, 40);
    document.body.append(bar);
    const box = contentBox(bar);
    expect(box).toEqual({ left: 113, right: 387 });
    const host = document.createElement('div');
    const tool = document.createElement('button');
    host.append(tool);
    tool.getBoundingClientRect = () => new DOMRect(113, 0, 274, 40);
    expect(within(box)(host)).toBe(true);
    tool.getBoundingClientRect = () => new DOMRect(112, 0, 44, 40);
    expect(within(box)(host)).toBe(false);
    tool.getBoundingClientRect = () => new DOMRect(344, 0, 44, 40);
    expect(within(box)(host)).toBe(false);
    tool.hidden = true; // folded: not counted
    expect(within(box)(host)).toBe(true);
  });
});
