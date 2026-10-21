// A long list that draws only the rows in sight, in a DOM that lays nothing
// out: the list is its own scroller, 200 px tall, its rows 20 px each until
// one is measured. ./window-range.test.ts holds the arithmetic.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERSCAN } from './window-range';
import { type WindowedRow, WindowedRows } from './windowed-rows';

const ROW = 20;
const VIEW = 200;
const COUNT = 1000;

let list: HTMLElement;
let made: Map<string, number>;

/** `count` rows, each a button; `shows` gives what row `i` shows. */
const rowsOf = (count: number, shows = (i: number) => `row ${i}`): WindowedRow[] =>
  Array.from({ length: count }, (_, i) => ({
    key: `k${i}`,
    shows: shows(i),
    make: () => {
      made.set(`k${i}`, (made.get(`k${i}`) ?? 0) + 1);
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = shows(i);
      item.append(button);
      return item;
    },
  }));

const drawn = () => [...list.querySelectorAll<HTMLElement>('[data-window-key]')];
const positions = () => drawn().map((row) => Number(row.getAttribute('aria-posinset')));
const spacers = () =>
  [...list.querySelectorAll<HTMLElement>('.window-spacer')].map((each) => each.style.height);
const focusedAt = () =>
  Number(document.activeElement?.closest('[aria-posinset]')?.getAttribute('aria-posinset'));
const press = (key: string) =>
  document.activeElement?.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );

function windowed(count = COUNT): WindowedRows {
  const rows = new WindowedRows(list, ROW);
  document.body.append(list);
  rows.set(rowsOf(count));
  return rows;
}

beforeEach(() => {
  made = new Map();
  list = document.createElement('ul');
  // The list scrolls itself, so where it starts in its scroller is 0.
  list.style.overflowY = 'auto';
  Object.defineProperty(list, 'clientHeight', { value: VIEW, configurable: true });
  document.body.replaceChildren();
});

describe('WindowedRows', () => {
  it('draws the rows in sight and a few either side, the spacers keeping the list its height', () => {
    windowed();
    const seen = VIEW / ROW;
    expect(positions()).toEqual(Array.from({ length: seen + OVERSCAN }, (_, i) => i + 1));
    expect(spacers()).toEqual(['0px', `${(COUNT - seen - OVERSCAN) * ROW}px`]);
    expect(drawn()[0]?.getAttribute('aria-setsize')).toBe(String(COUNT));
    expect(made.size).toBe(seen + OVERSCAN);
  });

  it('draws the rows scrolled to, and only those', () => {
    const rows = windowed();
    list.scrollTop = 500 * ROW;
    rows.render();
    const first = 500 - OVERSCAN;
    const last = 500 + VIEW / ROW + OVERSCAN;
    expect(positions()).toEqual(Array.from({ length: last - first }, (_, i) => first + i + 1));
    expect(spacers()).toEqual([`${first * ROW}px`, `${(COUNT - last) * ROW}px`]);
  });

  it('follows a scroll on the next frame', async () => {
    windowed();
    list.scrollTop = 300 * ROW;
    list.dispatchEvent(new Event('scroll'));
    await new Promise(requestAnimationFrame);
    expect(positions()).toContain(301);
    expect(positions()).not.toContain(1);
  });

  it('measures its rows from one drawn, and lays the rest out by it', () => {
    const rows = new WindowedRows(list, ROW);
    document.body.append(list);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement,
    ) {
      return new DOMRect(0, 0, 100, this.dataset.windowKey ? 40 : 0);
    });
    try {
      rows.set(rowsOf(COUNT));
      const drawnNow = VIEW / 40 + OVERSCAN;
      expect(drawn()).toHaveLength(drawnNow);
      expect(spacers()[1]).toBe(`${(COUNT - drawnNow) * 40}px`);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('draws nothing until it is in the window', () => {
    const rows = new WindowedRows(list, ROW);
    rows.set(rowsOf(COUNT));
    expect(drawn()).toHaveLength(0);
    expect(rows.size).toBe(COUNT);
    document.body.append(list);
    rows.render();
    expect(drawn().length).toBeGreaterThan(0);
  });

  describe('the keyboard', () => {
    it('reaches every row, drawn or not: End, Home, the arrows, a page at a time', () => {
      windowed();
      drawn()[0]?.querySelector('button')?.focus();
      press('End');
      expect(focusedAt()).toBe(COUNT);
      expect(document.activeElement?.tagName).toBe('BUTTON');
      expect(positions()).not.toContain(1);
      press('ArrowUp');
      expect(focusedAt()).toBe(COUNT - 1);
      press('ArrowDown');
      press('ArrowDown');
      expect(focusedAt()).toBe(COUNT);
      press('Home');
      expect(focusedAt()).toBe(1);
      press('ArrowUp');
      expect(focusedAt()).toBe(1);
      // A page: the rows that fit, less one kept in sight.
      press('PageDown');
      expect(focusedAt()).toBe(1 + VIEW / ROW - 1);
      press('PageUp');
      expect(focusedAt()).toBe(1);
    });

    it('leaves a modified arrow to whoever listens for it (Alt+↓ moves a note)', () => {
      windowed();
      drawn()[0]?.querySelector('button')?.focus();
      const down = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        altKey: true,
        bubbles: true,
        cancelable: true,
      });
      document.activeElement?.dispatchEvent(down);
      expect(down.defaultPrevented).toBe(false);
      expect(focusedAt()).toBe(1);
    });

    it('is held by the list while its row is scrolled away, and carries on from that row', () => {
      const rows = windowed();
      drawn()[4]?.querySelector('button')?.focus();
      list.scrollTop = 600 * ROW;
      rows.render();
      expect(document.activeElement).toBe(list);
      expect(positions()).not.toContain(5);
      press('ArrowDown');
      expect(focusedAt()).toBe(6);
      expect(document.activeElement?.tagName).toBe('BUTTON');
    });

    it('is given back to a row by its key, scrolled into sight; no row, no keyboard', () => {
      const rows = windowed();
      expect(rows.focusKey('k750')).toBe(true);
      expect(focusedAt()).toBe(751);
      expect(list.scrollTop).toBeGreaterThan(0);
      expect(rows.focusKey('gone')).toBe(false);
      expect(focusedAt()).toBe(751);
    });

    it('reveals a row by its key, drawn into sight, without taking the keyboard', () => {
      const rows = windowed();
      const field = document.createElement('input');
      document.body.append(field);
      field.focus();
      const row = rows.reveal('k900');
      expect(row?.isConnected).toBe(true);
      expect(row?.getAttribute('aria-posinset')).toBe('901');
      expect(document.activeElement).toBe(field);
      expect(rows.reveal('gone')).toBeNull();
    });
  });

  describe('set again', () => {
    it('keeps each row’s element while it shows the same, and makes again only what changed', () => {
      const rows = windowed();
      const before = drawn();
      rows.set(rowsOf(COUNT, (i) => (i === 2 ? 'renamed' : `row ${i}`)));
      const after = drawn();
      expect(after.filter((row, at) => row !== before[at])).toEqual([after[2]]);
      expect(after[2]?.textContent).toBe('renamed');
      expect(made.get('k2')).toBe(2);
      expect(made.get('k3')).toBe(1);
    });

    it('moves a kept row to its new place rather than making it again', () => {
      const rows = windowed(300);
      const second = drawn()[1];
      const moved = rowsOf(300);
      const [a, b] = moved;
      if (a && b) moved.splice(0, 2, b, a);
      rows.set(moved);
      expect(drawn()[0]).toBe(second);
      expect(drawn()[0]?.getAttribute('aria-posinset')).toBe('1');
      expect(made.get('k1')).toBe(1);
    });

    it('forgets rows that are gone, so one coming back is made again', () => {
      const rows = windowed(300);
      rows.set(rowsOf(300).slice(1));
      expect(drawn()[0]?.dataset.windowKey).toBe('k1');
      rows.set(rowsOf(300));
      expect(made.get('k0')).toBe(2);
    });

    it('lets go of a held row that is gone: the keyboard has nowhere to carry on from', () => {
      const rows = windowed();
      drawn()[4]?.querySelector('button')?.focus();
      list.scrollTop = 600 * ROW;
      rows.render();
      expect(document.activeElement).toBe(list);
      rows.set(rowsOf(COUNT).filter((row) => row.key !== 'k4'));
      press('ArrowDown');
      expect(focusedAt()).toBe(1);
    });
  });
});
