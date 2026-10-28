// The find bar apart from what it searches (./find-bar.ts): driven here by a
// stand-in target with a matcher of its own, as a book's chapters will drive
// it (backlog #40), with and without Replace. A note's, through CodeMirror,
// is ../editor/find.test.ts's.

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FindCount } from '../../core/find';
import { FindBar } from './find-bar';
import type { FindQuery, FindTarget } from './find-target';

afterEach(() => {
  document.body.replaceChildren();
});

/** A target over `words` that finds a query's words in them, the bar told as a target tells it. */
function standIn(words: string, more: Partial<FindTarget> = {}) {
  const calls: string[] = [];
  let query: FindQuery | null = null;
  let at = 0;
  let open = false;
  const readable = (q: FindQuery) => {
    if (!q.regexp) return true;
    try {
      new RegExp(q.search);
      return true;
    } catch {
      return false;
    }
  };
  const matches = () => {
    if (!query?.search || !readable(query)) return [];
    const flags = query.caseSensitive ? 'g' : 'gi';
    const pattern = query.regexp
      ? query.search
      : query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...words.matchAll(new RegExp(pattern, flags))].map((match) => match.index ?? 0);
  };
  const target: FindTarget = {
    open() {
      calls.push('open');
      open = true;
      bar.shown(true);
    },
    close() {
      if (!open) return false;
      calls.push('close');
      open = false;
      bar.shown(false);
      return true;
    },
    chosen: () => '',
    valid: (q) => q.search !== '' && readable(q),
    query(q, narrow) {
      calls.push(narrow ? 'narrow' : 'query');
      query = q;
      at = matches().length > 0 ? 1 : 0;
      bar.changed();
    },
    next() {
      calls.push('next');
      at = (at % matches().length) + 1;
      bar.changed();
      return true;
    },
    previous() {
      calls.push('previous');
      return true;
    },
    count(): FindCount | 'invalid' {
      if (query && !readable(query)) return 'invalid';
      return { current: at, total: matches().length, more: false };
    },
    ...more,
  };
  const bar = new FindBar(target, 'Find in the book');
  document.body.append(bar.element);
  return { bar, calls, query: () => query };
}

const field = (bar: FindBar, name: string) =>
  bar.element.querySelector<HTMLInputElement>(`input[aria-label="${name}"]`);
const button = (bar: FindBar, name: string) =>
  bar.element.querySelector<HTMLButtonElement>(`button[aria-label^="${name}"]`);
const count = (bar: FindBar) => bar.element.querySelector('[role="status"]')?.textContent;
const type = (input: HTMLInputElement | null, text: string) => {
  if (!input) throw new Error('no field');
  input.value = text;
  input.dispatchEvent(new Event('input'));
};
const press = (target: Element | null, key: string, more: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...more });
  target?.dispatchEvent(event);
  return event;
};

describe('the find bar', () => {
  it('is a search landmark named as it was made, built only once it opens', () => {
    const { bar } = standIn('Snow.');
    expect(bar.element.getAttribute('role')).toBe('search');
    expect(bar.element.getAttribute('aria-label')).toBe('Find in the book');
    expect(bar.element.hidden).toBe(true);
    expect(bar.element.children).toHaveLength(0);
    bar.open(false);
    expect(bar.element.hidden).toBe(false);
    expect(document.activeElement).toBe(field(bar, 'Find'));
  });

  it('shows its matches before setting its query, and narrows from the match as letters are typed', () => {
    const { bar, calls } = standIn('The bell, the bell, the bell.');
    bar.open(false);
    expect(calls).toEqual(['open', 'query']);
    type(field(bar, 'Find'), 'bell');
    expect(calls.at(-1)).toBe('narrow');
    expect(count(bar)).toBe('1 of 3');
  });

  it('gives each option to the target, pressed or not', () => {
    const { bar, query } = standIn('Bell bell.');
    bar.open(false);
    type(field(bar, 'Find'), 'Bell');
    expect(count(bar)).toBe('1 of 2');
    button(bar, 'Match case')?.click();
    expect(button(bar, 'Match case')?.getAttribute('aria-pressed')).toBe('true');
    expect(query()?.caseSensitive).toBe(true);
    expect(count(bar)).toBe('1 of 1');
    button(bar, 'Whole word')?.click();
    expect(query()?.wholeWord).toBe(true);
  });

  it('seeds Find with the words chosen: one line, not too long, as a pattern escaped', () => {
    let chosen = 'the bell';
    const { bar } = standIn('the bell.', { chosen: () => chosen });
    bar.open(false);
    expect(field(bar, 'Find')?.value).toBe('the bell');
    chosen = 'two\nlines';
    bar.open(false);
    expect(field(bar, 'Find')?.value).toBe('the bell');
    chosen = 'x'.repeat(101);
    bar.open(false);
    expect(field(bar, 'Find')?.value).toBe('the bell');
    button(bar, 'Pattern')?.click();
    chosen = 'a.b';
    bar.open(false);
    expect(field(bar, 'Find')?.value).toBe('a\\.b');
  });

  it('moves by Enter and ⇧Enter, but not with another modifier, nor mid-composition', () => {
    const { bar, calls } = standIn('bell bell');
    bar.open(false);
    type(field(bar, 'Find'), 'bell');
    calls.length = 0;
    expect(press(field(bar, 'Find'), 'Enter').defaultPrevented).toBe(true);
    press(field(bar, 'Find'), 'Enter', { shiftKey: true });
    press(field(bar, 'Find'), 'Enter', { metaKey: true });
    press(field(bar, 'Find'), 'Enter', { altKey: true });
    press(field(bar, 'Find'), 'Enter', { isComposing: true });
    expect(calls).toEqual(['next', 'previous']);
  });

  it('opens rather than moves with nothing to search', () => {
    const { bar, calls } = standIn('bell');
    bar.next();
    expect(calls).toEqual(['open', 'query']);
    expect(bar.element.hidden).toBe(false);
  });

  it('says a pattern can’t be read, and stops saying so once it can', () => {
    const { bar } = standIn('bell');
    bar.open(false);
    button(bar, 'Pattern')?.click();
    type(field(bar, 'Find'), 'bell(');
    expect(count(bar)).toBe('Not a valid pattern');
    expect(field(bar, 'Find')?.getAttribute('aria-invalid')).toBe('true');
    type(field(bar, 'Find'), 'bell');
    expect(field(bar, 'Find')?.hasAttribute('aria-invalid')).toBe(false);
  });

  it('shuts by Esc (taken, so a phone’s Back knows) and by its ×', () => {
    const { bar } = standIn('bell');
    bar.open(false);
    expect(press(field(bar, 'Find'), 'Escape').defaultPrevented).toBe(true);
    expect(bar.element.hidden).toBe(true);
    expect(press(bar.element, 'Escape').defaultPrevented).toBe(false); // shut already: not taken
    bar.open(false);
    button(bar, 'Close')?.click();
    expect(bar.element.hidden).toBe(true);
  });

  it('hears the target’s own keys first', () => {
    const key = vi.fn(() => true);
    const { bar, calls } = standIn('bell', { key });
    bar.open(false);
    type(field(bar, 'Find'), 'bell');
    calls.length = 0;
    expect(press(field(bar, 'Find'), 'Enter').defaultPrevented).toBe(true);
    expect(key).toHaveBeenCalled();
    expect(calls).toEqual([]); // the target took it: the bar's Enter never ran
  });
});

describe('without Replace', () => {
  it('draws none, and opens Find alone when asked for Replace', () => {
    const { bar } = standIn('bell');
    bar.open(true);
    expect(field(bar, 'Replace')).toBeNull();
    expect(button(bar, 'Find and replace')).toBeNull();
    expect(button(bar, 'Replace')).toBeNull();
    expect(bar.element.hasAttribute('data-replace')).toBe(false);
    expect(document.activeElement).toBe(field(bar, 'Find'));
    expect(bar.replaceAll()).toBe(false);
    expect(bar.replaceOne()).toBe(false);
  });
});

describe('with Replace', () => {
  function replacing() {
    let locked = false;
    const one = vi.fn(() => true);
    const all = vi.fn(() => true);
    const made = standIn('bell bell', { replace: { one, all, locked: () => locked } });
    return { ...made, one, all, lock: (to: boolean) => (locked = to) };
  }

  it('unfolds Replace, the keyboard in it once Find has words', () => {
    const { bar, query } = replacing();
    bar.open(false);
    type(field(bar, 'Find'), 'bell');
    bar.open(true);
    expect(bar.element.hasAttribute('data-replace')).toBe(true);
    expect(document.activeElement).toBe(field(bar, 'Replace'));
    type(field(bar, 'Replace'), 'gong');
    expect(query()?.replace).toBe('gong');
  });

  it('replaces by Enter in its field and by its buttons, and not while the text is locked', () => {
    const { bar, one, all, lock } = replacing();
    bar.open(true);
    press(field(bar, 'Replace'), 'Enter');
    button(bar, 'Replace all')?.click();
    expect(one).toHaveBeenCalledTimes(1);
    expect(all).toHaveBeenCalledTimes(1);
    lock(true);
    bar.changed();
    expect(field(bar, 'Replace')?.disabled).toBe(true);
    expect(button(bar, 'Replace all')?.disabled).toBe(true);
    lock(false);
    bar.changed();
    expect(field(bar, 'Replace')?.disabled).toBe(false);
  });

  it('folds and unfolds by its twisty', () => {
    const { bar } = replacing();
    bar.open(false);
    const twisty = button(bar, 'Find and replace');
    expect(twisty?.getAttribute('aria-expanded')).toBe('false');
    twisty?.click();
    expect(twisty?.getAttribute('aria-expanded')).toBe('true');
    expect(field(bar, 'Replace')?.hidden).toBe(false);
    expect(document.activeElement).toBe(field(bar, 'Replace'));
  });

  it('hides when the target says its matches are hidden', () => {
    const { bar } = replacing();
    bar.open(false);
    bar.shown(false);
    expect(bar.element.hidden).toBe(true);
  });
});
