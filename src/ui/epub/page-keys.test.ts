import { afterEach, describe, expect, it, vi } from 'vitest';
import { pageKey, pageTap } from './page-keys';

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
