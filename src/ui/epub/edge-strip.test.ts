// The whole book down the page's edge (#40, Phase 4d): its pieces at their
// shares of the book, the place said to a screen reader, its keys, and a
// point on it chosen.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { EdgeStrip } from './edge-strip';

/** A strip 200px tall from the window's top at 100, as the window lays it out. */
function strip() {
  const of = {
    go: vi.fn(),
    step: vi.fn(),
    describe: vi.fn((share: number) => `at ${Math.round(share * 100)}`),
  };
  const made = new EdgeStrip(of);
  made.element.getBoundingClientRect = () => ({ top: 100, height: 200 }) as DOMRect;
  document.body.append(made.element);
  return { made, of, element: made.element };
}
const pointer = (type: string, clientY: number, pointerType = 'mouse') =>
  new PointerEvent(type, { clientY, button: 0, pointerType, bubbles: true, cancelable: true });

afterEach(() => document.body.replaceChildren());

describe('the strip down a book’s edge', () => {
  it('draws each chapter at its share of the book, a longer one each tenth, and each mark of its kind', () => {
    const { made, element } = strip();
    made.draw({
      chapters: Array.from({ length: 12 }, (_, i) => i / 12),
      marks: [
        { kind: 'bookmark', share: 0.5 },
        { kind: 'bookmark', share: 2 },
        { kind: 'highlight', share: 0.25 },
      ],
    });
    expect(element.querySelectorAll('.edge-strip__highlight')).toHaveLength(1);
    const chapters = [...element.querySelectorAll<HTMLElement>('.edge-strip__chapter')];
    expect(chapters).toHaveLength(12);
    expect(chapters.map((each) => each.classList.contains('edge-strip__chapter--tenth'))).toEqual(
      Array.from({ length: 12 }, (_, i) => i % 10 === 0),
    );
    const marks = [...element.querySelectorAll<HTMLElement>('.edge-strip__mark')];
    // A share past the book's end held at it.
    expect(marks.map((each) => each.style.getPropertyValue('--at'))).toEqual(['0.5', '1']);
    made.draw({ chapters: [0], marks: [] });
    expect(element.querySelectorAll('.edge-strip__chapter, .edge-strip__mark')).toHaveLength(1);
  });

  it('is a slider saying the place in the words it’s given, its bar where it is', () => {
    const { made, element } = strip();
    expect(element.getAttribute('role')).toBe('slider');
    expect(element.getAttribute('aria-orientation')).toBe('vertical');
    made.place(0.256, 'Chapter III, page 12 of 2,450');
    // Rounded down, as "25% of the book" is (#67): never 26 beside it.
    expect(element.getAttribute('aria-valuenow')).toBe('25');
    expect(element.getAttribute('aria-valuetext')).toBe('Chapter III, page 12 of 2,450');
    // The same share in another book: its own words, never the last one's.
    made.place(0.256, 'Chapter I');
    expect(element.getAttribute('aria-valuetext')).toBe('Chapter I');
    expect(
      element.querySelector<HTMLElement>('.edge-strip__here')?.style.getPropertyValue('--at'),
    ).toBe('0.256');
  });

  it('steps by its keys alone, never a page’s', () => {
    const { of, element } = strip();
    const page = vi.fn();
    document.body.addEventListener('keydown', page);
    const press = (key: string, init: KeyboardEventInit = {}) =>
      element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
    for (const key of ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End']) press(key);
    expect(of.step.mock.calls.map(([by]) => by)).toEqual([1, -1, 10, -10, 'first', 'last']);
    expect(page).not.toHaveBeenCalled();
    press('ArrowRight');
    press('ArrowDown', { metaKey: true });
    expect(of.step).toHaveBeenCalledTimes(6);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('shows what’s under the pointer, and goes where it’s let go', () => {
    const { of, element } = strip();
    const tip = element.querySelector<HTMLElement>('.edge-strip__tip');
    element.dispatchEvent(pointer('pointermove', 150));
    expect(tip?.hidden).toBe(false);
    expect(tip?.textContent).toBe('at 25');
    element.dispatchEvent(pointer('pointerleave', 150));
    expect(tip?.hidden).toBe(true);
    // A hand scrubs: down, drawn along, lifted.
    element.dispatchEvent(pointer('pointerdown', 120));
    element.dispatchEvent(pointer('pointermove', 260));
    expect(tip?.textContent).toBe('at 80');
    expect(of.go).not.toHaveBeenCalled();
    element.dispatchEvent(pointer('pointerup', 260));
    expect(of.go).toHaveBeenCalledExactlyOnceWith(0.8);
    expect(tip?.hidden).toBe(true);
  });

  it('goes nowhere for a finger’s tap, and where a finger’s scrub is lifted', () => {
    const { of, element } = strip();
    element.dispatchEvent(pointer('pointerdown', 150, 'touch'));
    element.dispatchEvent(pointer('pointermove', 153, 'touch'));
    element.dispatchEvent(pointer('pointerup', 153, 'touch'));
    expect(of.go).not.toHaveBeenCalled();
    element.dispatchEvent(pointer('pointerdown', 150, 'touch'));
    element.dispatchEvent(pointer('pointermove', 200, 'touch'));
    element.dispatchEvent(pointer('pointerup', 200, 'touch'));
    expect(of.go).toHaveBeenCalledExactlyOnceWith(0.5);
  });

  it('lets a hold go when the window takes the pointer away', () => {
    const { of, element } = strip();
    const tip = element.querySelector<HTMLElement>('.edge-strip__tip');
    element.dispatchEvent(pointer('pointerdown', 150));
    element.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true }));
    expect(tip?.hidden).toBe(true);
    element.dispatchEvent(pointer('pointerup', 150));
    expect(of.go).not.toHaveBeenCalled();
  });

  it('keeps its pointer from the page beneath: a hand’s turn never starts there', () => {
    const { element } = strip();
    const page = vi.fn();
    document.body.addEventListener('pointerdown', page);
    element.dispatchEvent(pointer('pointerdown', 150, 'touch'));
    expect(page).not.toHaveBeenCalled();
  });
});
