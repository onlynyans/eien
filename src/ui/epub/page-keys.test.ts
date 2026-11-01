import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookKey, pageKey, pageTap } from './page-keys';

const press = (key: string, init: KeyboardEventInit = {}, target?: Element) => {
  const of = { turn: vi.fn(), edge: vi.fn() };
  const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
  if (target) Object.defineProperty(event, 'target', { value: target });
  pageKey(event, of);
  return { ...of, prevented: event.defaultPrevented };
};

afterEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.replaceChildren();
});

describe('a page’s keys in pages', () => {
  it('turns on and back by the arrows, Space and Page Up and Down, and goes to the chapter’s ends', () => {
    for (const key of ['ArrowRight', 'ArrowDown', 'PageDown', ' ']) {
      expect(press(key).turn).toHaveBeenCalledWith(1, false);
    }
    for (const key of ['ArrowLeft', 'ArrowUp', 'PageUp']) {
      expect(press(key).turn).toHaveBeenCalledWith(-1, false);
    }
    expect(press(' ', { shiftKey: true }).turn).toHaveBeenCalledWith(-1, false);
    expect(press('Home').edge).toHaveBeenCalledWith(false);
    expect(press('End').edge).toHaveBeenCalledWith(true);
    expect(press('ArrowRight').prevented).toBe(true);
  });

  it('a key held down turns at once', () => {
    expect(press('ArrowRight', { repeat: true }).turn).toHaveBeenCalledWith(1, true);
  });

  it('leaves a button’s own Space, Shift with an arrow, and other keys alone', () => {
    const button = document.createElement('button');
    expect(press(' ', {}, button).turn).not.toHaveBeenCalled();
    expect(press('ArrowRight', { shiftKey: true }).turn).not.toHaveBeenCalled();
    expect(press('a').prevented).toBe(false);
  });

  it('turns from a clicked edge or a link the keyboard is on, by the arrows and the page keys', () => {
    const button = document.createElement('button');
    expect(press('ArrowRight', {}, button).turn).toHaveBeenCalledWith(1, false);
    const link = document.createElement('a');
    link.href = '#x';
    expect(press('PageUp', {}, link).turn).toHaveBeenCalledWith(-1, false);
  });
});

describe('a tap in pages', () => {
  const box = () => {
    const element = document.createElement('div');
    element.innerHTML = '<p>Words <a href="#n">1</a></p>';
    element.getBoundingClientRect = () => ({ left: 0, width: 300 }) as DOMRect;
    document.body.append(element);
    return element;
  };
  const tap = (x: number, pointerType = 'touch', target?: Element) => {
    const element = box();
    const of = { turn: vi.fn(), edge: vi.fn() };
    // A plain click, as WebKit's is: the pointer's type is its pointerdown's.
    const event = new MouseEvent('click', { clientX: x });
    Object.defineProperty(event, 'target', { value: target ?? element.querySelector('p') });
    pageTap(event, pointerType, element, of);
    return of.turn;
  };

  it('turns back in the left third and on in the right, the middle left for the reader', () => {
    expect(tap(50)).toHaveBeenCalledWith(-1, false);
    expect(tap(250)).toHaveBeenCalledWith(1, false);
    expect(tap(150)).not.toHaveBeenCalled();
  });

  it('is a touch’s alone, never on a link, nor ending a selection', () => {
    expect(tap(250, 'mouse')).not.toHaveBeenCalled();
    const link = document.createElement('a');
    link.href = '#n';
    expect(tap(250, 'touch', link)).not.toHaveBeenCalled();
    const words = document.createElement('p');
    words.textContent = 'Chosen words';
    document.body.append(words);
    document.getSelection()?.selectAllChildren(words);
    expect(tap(250)).not.toHaveBeenCalled();
  });
});

describe('a book’s page’s keys', () => {
  /** The page's keys over a page in the state `now` gives, `key` pressed on `target`. */
  function bookPress(
    key: string,
    init: KeyboardEventInit = {},
    now: Partial<{ chosen: boolean; shown: boolean; paged: boolean; back: boolean }> = {},
    target?: Element,
  ) {
    const state = { chosen: false, shown: true, paged: false, back: false, ...now };
    const of = {
      turn: vi.fn(),
      edge: vi.fn(),
      quote: vi.fn(),
      bookmark: vi.fn(),
      highlight: vi.fn(),
      back: vi.fn(),
      chosen: () => state.chosen,
      shown: () => state.shown,
      paged: () => state.paged,
      canGoBack: () => state.back,
    };
    const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
    if (target) Object.defineProperty(event, 'target', { value: target });
    bookKey(event, of);
    return { ...of, prevented: event.defaultPrevented };
  }

  it('quotes by Q only with words chosen, and bookmarks by B only with a book shown', () => {
    expect(bookPress('q', {}, { chosen: true }).quote).toHaveBeenCalledOnce();
    const none = bookPress('q');
    expect(none.quote).not.toHaveBeenCalled();
    expect(none.prevented).toBe(false);
    expect(bookPress('B').bookmark).toHaveBeenCalledOnce();
    expect(bookPress('b', {}, { shown: false }).bookmark).not.toHaveBeenCalled();
  });

  it('runs a letter once while it’s held, and never with ⌘, Ctrl or Alt', () => {
    const held = bookPress('b', { repeat: true });
    expect(held.bookmark).not.toHaveBeenCalled();
    expect(held.prevented).toBe(true);
    for (const modifier of ['metaKey', 'ctrlKey', 'altKey'])
      expect(bookPress('b', { [modifier]: true }).bookmark).not.toHaveBeenCalled();
  });

  it('goes back by ⌘[, Ctrl+[ or Alt+←, only with a step to take', () => {
    expect(bookPress('[', { metaKey: true }, { back: true }).back).toHaveBeenCalledOnce();
    expect(bookPress('[', { ctrlKey: true }, { back: true }).back).toHaveBeenCalledOnce();
    expect(bookPress('ArrowLeft', { altKey: true }, { back: true }).back).toHaveBeenCalledOnce();
    const none = bookPress('[', { metaKey: true });
    expect(none.back).not.toHaveBeenCalled();
    expect(none.prevented).toBe(false);
  });

  it('turns in pages alone, and does nothing from a field', () => {
    expect(bookPress('ArrowRight', {}, { paged: true }).turn).toHaveBeenCalledWith(1, false);
    expect(bookPress('ArrowRight').turn).not.toHaveBeenCalled();
    const field = document.createElement('input');
    const typed = bookPress('b', {}, { paged: true }, field);
    expect(typed.bookmark).not.toHaveBeenCalled();
    expect(typed.prevented).toBe(false);
  });
});
