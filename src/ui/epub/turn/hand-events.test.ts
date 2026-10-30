import { afterEach, describe, expect, it, vi } from 'vitest';
import { handEvents } from './hand-events';
import type { PageTurn } from './page-turn';

/** A page in pages: its pane, its sheet (400 by 600 at the window's top left), its edge. */
function page({ paged = true, catchable = false, lets = true, width = 400 } = {}) {
  const target = document.createElement('div');
  target.innerHTML =
    '<article class="sheet"><p class="words">Words <a href="#n">1</a></p></article><button class="edge"></button>';
  document.body.append(target);
  const sheet = target.querySelector('.sheet') as HTMLElement;
  Object.defineProperty(sheet, 'offsetWidth', { value: 400 });
  // Drawn `width` wide at the sheet's own 400: the page's zoom.
  sheet.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height: (600 * width) / 400 }) as DOMRect;
  target.setPointerCapture = vi.fn();
  target.hasPointerCapture = () => false;
  const turn = {
    grab: vi.fn(),
    drag: vi.fn(),
    letGo: vi.fn(() => lets),
    cancel: vi.fn(() => true),
    turning: catchable,
    catchable,
  } as unknown as PageTurn;
  const stop = handEvents(turn, { target, sheet: () => sheet, paged: () => paged, edges: '.edge' });
  stops.push(stop);
  const on = (selector: string) => target.querySelector(selector) as HTMLElement;
  return { target, turn, on, stop };
}

const pointer = (type: string, init: PointerEventInit, at?: number) => {
  const event = new PointerEvent(type, {
    bubbles: true,
    pointerId: 1,
    button: 0,
    isPrimary: true,
    ...init,
  });
  if (at !== undefined) Object.defineProperty(event, 'timeStamp', { value: at });
  return event;
};

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe('a hand on a page in pages', () => {
  it('takes the page under a finger anywhere on it, and carries the drag and the lift', () => {
    const { turn, on } = page();
    on('.words').dispatchEvent(
      pointer('pointerdown', { pointerType: 'touch', clientX: 380, clientY: 500 }),
    );
    expect(turn.grab).toHaveBeenCalledWith([380, 500]);
    window.dispatchEvent(
      pointer('pointermove', { pointerType: 'touch', clientX: 300, clientY: 490 }),
    );
    expect(turn.drag).toHaveBeenCalledWith([-80, -10], expect.any(Number));
    window.dispatchEvent(
      pointer('pointerup', { pointerType: 'touch', clientX: 300, clientY: 490 }),
    );
    expect(turn.letGo).toHaveBeenCalledOnce();
  });

  it('a mouse takes it at the edges alone: over the words, a mouse chooses them', () => {
    const words = page();
    words
      .on('.words')
      .dispatchEvent(pointer('pointerdown', { pointerType: 'mouse', clientX: 300 }));
    expect(words.turn.grab).not.toHaveBeenCalled();
    const edge = page();
    edge.on('.edge').dispatchEvent(pointer('pointerdown', { pointerType: 'mouse', clientX: 402 }));
    expect(edge.turn.grab).toHaveBeenCalled();
  });

  it('a mouse catches a page in flight anywhere on it', () => {
    const { turn, on } = page({ catchable: true });
    on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'mouse', clientX: 200 }));
    expect(turn.grab).toHaveBeenCalled();
  });

  it('never in Scroll, on a link, nor while words are chosen', () => {
    const scroll = page({ paged: false });
    scroll.on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
    expect(scroll.turn.grab).not.toHaveBeenCalled();
    const link = page();
    link.on('a').dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
    expect(link.turn.grab).not.toHaveBeenCalled();
    const chosen = page();
    document.getSelection()?.selectAllChildren(chosen.on('.words'));
    chosen.on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
    expect(chosen.turn.grab).not.toHaveBeenCalled();
  });

  it('a drag that turned is never also a click on what it began on; a tap still is', () => {
    const dragged = page();
    const clicked = vi.fn();
    dragged.on('.edge').addEventListener('click', clicked);
    dragged
      .on('.edge')
      .dispatchEvent(pointer('pointerdown', { pointerType: 'mouse', clientX: 402 }));
    window.dispatchEvent(pointer('pointerup', { pointerType: 'mouse' }));
    dragged.on('.edge').click();
    expect(clicked).not.toHaveBeenCalled();
    const tapped = page({ lets: false });
    const tap = vi.fn();
    tapped.on('.edge').addEventListener('click', tap);
    tapped
      .on('.edge')
      .dispatchEvent(pointer('pointerdown', { pointerType: 'mouse', clientX: 402 }));
    window.dispatchEvent(pointer('pointerup', { pointerType: 'mouse' }));
    tapped.on('.edge').click();
    expect(tap).toHaveBeenCalledOnce();
  });

  it('stops listening once let go', () => {
    const { turn, on, stop } = page();
    stop();
    on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'touch' }));
    expect(turn.grab).not.toHaveBeenCalled();
  });

  it('reads the hand through the page’s zoom', () => {
    const { turn, on } = page({ width: 600 });
    on('.words').dispatchEvent(
      pointer('pointerdown', { pointerType: 'touch', clientX: 450, clientY: 300 }),
    );
    expect(turn.grab).toHaveBeenCalledWith([300, 200]);
    window.dispatchEvent(
      pointer('pointermove', { pointerType: 'touch', clientX: 300, clientY: 300 }),
    );
    expect(turn.drag).toHaveBeenCalledWith([-100, 0], expect.any(Number));
  });

  it('a click long after a drag is the click’s own again', () => {
    const { on } = page();
    const clicked = vi.fn();
    on('.edge').addEventListener('click', clicked);
    on('.edge').dispatchEvent(pointer('pointerdown', { pointerType: 'mouse', clientX: 402 }, 0));
    window.dispatchEvent(pointer('pointerup', { pointerType: 'mouse' }, 100));
    const later = new MouseEvent('click', { bubbles: true });
    Object.defineProperty(later, 'timeStamp', { value: 1000 });
    on('.edge').dispatchEvent(later);
    expect(clicked).toHaveBeenCalledOnce();
  });

  it('a second finger never takes the page; a new first pointer puts the lost one’s page down', () => {
    const { turn, on } = page();
    on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'touch', clientX: 380 }));
    on('.words').dispatchEvent(
      pointer('pointerdown', { pointerType: 'touch', pointerId: 2, isPrimary: false }),
    );
    expect(turn.grab).toHaveBeenCalledOnce();
    window.dispatchEvent(
      pointer('pointermove', { pointerType: 'touch', pointerId: 2, clientX: 10 }),
    );
    expect(turn.drag).not.toHaveBeenCalled();
    on('.words').dispatchEvent(
      pointer('pointerdown', { pointerType: 'touch', pointerId: 3, clientX: 300 }),
    );
    expect(turn.cancel).toHaveBeenCalledOnce();
    expect(turn.grab).toHaveBeenCalledTimes(2);
  });

  it('a cancelled gesture puts the page down, never thrown', () => {
    const { turn, on } = page();
    on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'touch', clientX: 380 }));
    window.dispatchEvent(pointer('pointercancel', { pointerType: 'touch' }));
    expect(turn.cancel).toHaveBeenCalledOnce();
    expect(turn.letGo).not.toHaveBeenCalled();
  });

  it('takes no other button, nor a pen over the words', () => {
    const right = page();
    right.on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'touch', button: 2 }));
    expect(right.turn.grab).not.toHaveBeenCalled();
    const pen = page();
    pen.on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'pen' }));
    expect(pen.turn.grab).not.toHaveBeenCalled();
  });

  it('catches a curl in flight on a link, and chooses no words while it holds', () => {
    const { turn, on } = page({ catchable: true });
    on('a').dispatchEvent(pointer('pointerdown', { pointerType: 'mouse' }));
    expect(turn.grab).toHaveBeenCalled();
    const start = new Event('selectstart', { bubbles: true, cancelable: true });
    on('.words').dispatchEvent(start);
    expect(start.defaultPrevented).toBe(true);
  });

  it('words chosen elsewhere (a note beside) never stop the book’s hand', () => {
    const { turn, on } = page();
    const note = document.createElement('p');
    note.textContent = 'A note’s words';
    document.body.append(note);
    document.getSelection()?.selectAllChildren(note);
    on('.words').dispatchEvent(pointer('pointerdown', { pointerType: 'touch', clientX: 380 }));
    expect(turn.grab).toHaveBeenCalled();
  });
});
