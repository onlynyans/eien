import { afterEach, describe, expect, it, vi } from 'vitest';
import { bookKey, pageKey, pageTap, tapDown } from './page-keys';

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
  const tap = (x: number, pointer = 'touch', target?: Element, chosen = false) => {
    const element = box();
    const of = { turn: vi.fn(), edge: vi.fn() };
    // A plain click, as WebKit's is: the pointer's type is its pointerdown's.
    const event = new MouseEvent('click', { clientX: x });
    Object.defineProperty(event, 'target', { value: target ?? element.querySelector('p') });
    pageTap(event, { pointer, chosen }, element, of);
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

  it('never turns on the tap that ends a choice, though the system dropped it before the click (#65)', () => {
    expect(tap(250, 'touch', undefined, true)).not.toHaveBeenCalled();
  });

  it('reads at the pointerdown whether words were chosen on the page, never a note’s beside', () => {
    const page = document.createElement('div');
    page.innerHTML = '<p>Chosen words</p>';
    const note = document.createElement('p');
    note.textContent = 'A note’s words';
    document.body.append(page, note);
    const down = new PointerEvent('pointerdown', { pointerType: 'touch' });
    expect(tapDown(down, page)).toEqual({ pointer: 'touch', chosen: false });
    document.getSelection()?.selectAllChildren(note);
    expect(tapDown(down, page)).toEqual({ pointer: 'touch', chosen: false });
    document.getSelection()?.selectAllChildren(page.querySelector('p') as Node);
    expect(tapDown(down, page)).toEqual({ pointer: 'touch', chosen: true });
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
      walk: vi.fn(),
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

  it('walks the marks by ] and [, however a layout types them, never ⌘[ or Ctrl+[ (Back)', () => {
    expect(bookPress(']').walk).toHaveBeenCalledWith(1);
    expect(bookPress('[').walk).toHaveBeenCalledWith(-1);
    // AltGr (Ctrl+Alt on Windows) and a Mac's Option, which type a bracket on some layouts.
    expect(bookPress('[', { ctrlKey: true, altKey: true }).walk).toHaveBeenCalledWith(-1);
    expect(bookPress(']', { altKey: true }).walk).toHaveBeenCalledWith(1);
    const back = bookPress('[', { metaKey: true }, { back: true });
    expect(back.walk).not.toHaveBeenCalled();
    expect(back.back).toHaveBeenCalledOnce();
    expect(bookPress('[', { ctrlKey: true }).walk).not.toHaveBeenCalled();
    expect(bookPress(']', {}, { shown: false }).walk).not.toHaveBeenCalled();
    expect(bookPress(']', {}, {}, document.createElement('input')).walk).not.toHaveBeenCalled();
  });

  // QA (#40, Phase 5b).
  it('walks by a bracket a layout types with Shift, but never by ⌘] or Ctrl+], nor { or }', () => {
    // A layout whose ] needs Shift (or Shift and Option): the key is the bracket all the same.
    const shifted = bookPress(']', { shiftKey: true });
    expect(shifted.walk).toHaveBeenCalledExactlyOnceWith(1);
    expect(shifted.prevented).toBe(true);
    expect(bookPress('[', { shiftKey: true, altKey: true }).walk).toHaveBeenCalledWith(-1);
    for (const modifier of ['metaKey', 'ctrlKey']) {
      const held = bookPress(']', { [modifier]: true });
      expect(held.walk, modifier).not.toHaveBeenCalled();
      expect(held.prevented, modifier).toBe(false);
    }
    // Shift and a bracket key on a US layout: braces, a note's to type, never a walk.
    for (const key of ['{', '}'])
      expect(bookPress(key, { shiftKey: true }).walk).not.toHaveBeenCalled();
  });

  it('walks in pages without turning, and leaves the key alone with no book shown', () => {
    const paged = bookPress(']', {}, { paged: true });
    expect(paged.walk).toHaveBeenCalledWith(1);
    expect(paged.turn).not.toHaveBeenCalled();
    expect(paged.edge).not.toHaveBeenCalled();
    expect(paged.back).not.toHaveBeenCalled();
    const none = bookPress('[', {}, { shown: false, back: true });
    expect(none.walk).not.toHaveBeenCalled();
    expect(none.back).not.toHaveBeenCalled();
    expect(none.prevented).toBe(false);
  });

  it('never walks from the note beside’s editor or a field of the page’s', () => {
    const editor = document.createElement('div');
    editor.className = 'editor-host';
    const inside = editor.appendChild(document.createElement('span'));
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    for (const target of [inside, editable, document.createElement('textarea')]) {
      const typed = bookPress(']', {}, {}, target);
      expect(typed.walk).not.toHaveBeenCalled();
      expect(typed.prevented).toBe(false);
    }
  });
});
