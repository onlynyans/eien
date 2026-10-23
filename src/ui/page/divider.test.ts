// The divider between two pages: moved by the keyboard or a drag, evened,
// remembered on this device, and named for assistive tech as it stands.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { STEP } from '../shell/pane-state';
import { Divider } from './divider';

const WIDTH = 1000;

function divider() {
  const events = { width: () => WIDTH, moved: vi.fn(), swap: vi.fn() };
  const made = new Divider(events);
  document.body.append(made.element);
  return { made, events, element: made.element };
}

const key = (element: HTMLElement, name: string) =>
  element.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );

afterEach(() => {
  document.body.replaceChildren();
  localStorage.clear();
});

describe('the divider', () => {
  it('is a separator, named, between 0 and 100, the keyboard able to reach it', () => {
    const { made, element } = divider();
    made.shown(WIDTH);
    expect(element.getAttribute('role')).toBe('separator');
    expect(element.getAttribute('aria-label')).toBe('Between the two pages');
    expect(element.getAttribute('aria-valuenow')).toBe('50');
    expect(element.tabIndex).toBe(0);
  });

  it('moves a step with each arrow key, and evens with Enter or a double-click', () => {
    const { made, events, element } = divider();
    key(element, 'ArrowRight');
    expect(made.shown(WIDTH)).toBeCloseTo(0.5 + STEP / WIDTH);
    key(element, 'ArrowLeft');
    key(element, 'ArrowLeft');
    expect(made.shown(WIDTH)).toBeCloseTo(0.5 - STEP / WIDTH);
    key(element, 'Enter');
    expect(made.shown(WIDTH)).toBe(0.5);
    key(element, 'ArrowRight');
    element.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(made.shown(WIDTH)).toBe(0.5);
    expect(events.moved).toHaveBeenCalledTimes(6);
  });

  it('follows a drag, and remembers where it was let go', () => {
    const { made, element } = divider();
    element.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 500, bubbles: true }),
    );
    document.dispatchEvent(new PointerEvent('pointermove', { buttons: 1, clientX: 600 }));
    expect(element.classList.contains('is-dragging')).toBe(true);
    document.dispatchEvent(new PointerEvent('pointerup', { clientX: 620 }));
    expect(element.classList.contains('is-dragging')).toBe(false);
    expect(made.shown(WIDTH)).toBeCloseTo(0.62);
    expect(divider().made.shown(WIDTH)).toBeCloseTo(0.62); // the next window's, as this device keeps it
  });

  it('swaps the pages with its ⇄, which no drag or double-click starts from', () => {
    const { events, element } = divider();
    const swap = element.querySelector<HTMLButtonElement>('.divider__swap');
    expect(swap?.getAttribute('aria-label')).toBe('Swap the pages');
    swap?.click();
    expect(events.swap).toHaveBeenCalledTimes(1);
    swap?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(events.moved).not.toHaveBeenCalled();
  });
});
