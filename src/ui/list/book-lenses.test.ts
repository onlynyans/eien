// A book's lenses and a bookmark's row (#40, Phase 4c), on their own: which
// keys take a bookmark off (every key and modifier tried, as one missed would
// unmark from ⌘⌫, the trash's key on a note's row, or from a key held down),
// what a row shows of a page not yet known, and the names the keyboard keeps.

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  lensButtons,
  MARK_SHORTCUTS,
  type MarkRow,
  markKey,
  markKeys,
  markName,
  markRow,
  markWhere,
} from './book-lenses';

afterEach(() => {
  document.body.replaceChildren();
});

const MODIFIERS = ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'] as const;
/** Every combination of the four modifiers, none first. */
const COMBOS = Array.from({ length: 16 }, (_, bits) =>
  Object.fromEntries(MODIFIERS.map((name, i) => [name, (bits & (1 << i)) !== 0])),
);

describe('a bookmark’s row’s keys', () => {
  it('take it off only for a plain Delete or Backspace, first pressed: never with a modifier, never a repeat', () => {
    for (const key of ['Delete', 'Backspace', 'Enter', 'd', ' ', 'ArrowDown'])
      for (const mods of COMBOS)
        for (const repeat of [false, true]) {
          const remove = vi.fn();
          const event = new KeyboardEvent('keydown', { key, repeat, cancelable: true, ...mods });
          markKeys(remove)(event);
          const plain =
            (key === 'Delete' || key === 'Backspace') && !Object.values(mods).some(Boolean);
          const what = `${key} ${JSON.stringify(mods)} repeat ${repeat}`;
          expect(remove.mock.calls.length, what).toBe(plain && !repeat ? 1 : 0);
          // A held key's repeats are the row's too: swallowed, so the window never takes them as its own.
          expect(event.defaultPrevented, what).toBe(plain);
        }
  });

  it('leave ⌘⌫ and Ctrl+Delete to go on up to whatever owns them', () => {
    const parent = document.body.appendChild(document.createElement('div'));
    const heard = vi.fn();
    parent.addEventListener('keydown', heard);
    const row = parent.appendChild(document.createElement('button'));
    row.addEventListener(
      'keydown',
      markKeys(() => {}),
    );
    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Backspace', metaKey: true, bubbles: true }),
    );
    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', ctrlKey: true, bubbles: true }),
    );
    expect(heard).toHaveBeenCalledTimes(2);
    // A plain one is the row's alone.
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(heard).toHaveBeenCalledTimes(2);
  });
});

describe('a bookmark’s row', () => {
  const row = (over: { page?: string | null } = {}): MarkRow => ({
    kind: 'bookmark' as const,
    offset: 40,
    mark: { chapter: 'c3.xhtml', offset: 40, words: 'Not all that Mrs. Bennet' },
    spine: 3,
    page: null,
    chapter: 'Chapter III',
    ...over,
  });

  it('shows no page in a chapter not yet counted, never a guess', () => {
    const button = markRow(
      row(),
      'k',
      () => {},
      () => {},
    );
    expect(button.querySelector('.mark-row__page')?.textContent).toBe('');
    expect(button.textContent?.trim()).not.toMatch(/\d/u);
  });

  it('says its keys, and goes there on a click', () => {
    const go = vi.fn();
    const button = markRow(row({ page: '12' }), 'k', go, () => {});
    expect(button.getAttribute('aria-keyshortcuts')).toBe(MARK_SHORTCUTS);
    expect(button.type).toBe('button');
    button.click();
    expect(go).toHaveBeenCalledOnce();
  });

  it('has a name of its own per place, so the keyboard comes back to the right one', () => {
    const keys = [
      markKey({
        kind: 'bookmark',
        spine: 0,
        offset: 0,
        mark: { chapter: 'c1.xhtml', offset: 0, words: '' },
      }),
      markKey({
        kind: 'bookmark',
        spine: 0,
        offset: 40,
        mark: { chapter: 'c1.xhtml', offset: 40, words: '' },
      }),
      markKey({
        kind: 'bookmark',
        spine: 0,
        offset: 0,
        mark: { chapter: 'c2.xhtml', offset: 0, words: '' },
      }),
      // A chapter whose name ends as another's offset begins.
      markKey({
        kind: 'bookmark',
        spine: 0,
        offset: 0,
        mark: { chapter: 'c1.xhtml:4', offset: 0, words: '' },
      }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    // Its words aren't its name: they may be read again differently, and it's the same bookmark.
    expect(
      markKey({
        kind: 'bookmark',
        spine: 0,
        offset: 0,
        mark: { chapter: 'c1.xhtml', offset: 0, words: 'a' },
      }),
    ).toBe(keys[0]);
  });
});

describe('a book’s lenses', () => {
  it('are pressed one at a time, and answer each click with its own lens', () => {
    const pressed = (lens: 'contents' | 'marks') =>
      [
        ...lensButtons(lens, { contents: 1, marks: 1, found: null }, () => {}).querySelectorAll(
          'button',
        ),
      ].map((button) => button.getAttribute('aria-pressed'));
    // Found is there with nothing searched, but can't be chosen: it has no count (Phase 5c).
    expect(pressed('contents')).toEqual(['true', 'false', 'false']);
    expect(pressed('marks')).toEqual(['false', 'true', 'false']);
    const choose = vi.fn();
    const group = lensButtons('marks', { contents: 61, marks: 0, found: null }, choose);
    const [contents, marks] = [...group.querySelectorAll('button')];
    // None kept still says how many: 0.
    expect(marks?.textContent).toBe('Marks 0');
    contents?.click();
    marks?.click();
    expect(choose.mock.calls).toEqual([['contents'], ['marks']]);
  });
});

// QA (#40, Phase 5b): a highlight's row beside a bookmark's, at one place too.
describe('a mark’s row of either kind', () => {
  const bookmarkAt = (offset: number): MarkRow => ({
    kind: 'bookmark',
    offset,
    spine: 3,
    mark: { chapter: 'c3.xhtml', offset, words: 'Not all that Mrs. Bennet' },
    page: '12',
    chapter: 'Chapter III',
  });
  const highlightAt = (from: number, to: number, words = 'universally acknowledged'): MarkRow => ({
    kind: 'highlight',
    offset: from,
    spine: 3,
    mark: { chapter: 'c3.xhtml', from, to, words },
    page: '12',
    chapter: 'Chapter III',
  });

  it('says its chapter and its kind under its words', () => {
    expect(markWhere(bookmarkAt(40))).toBe('Chapter III · bookmark');
    expect(markWhere(highlightAt(40, 60))).toBe('Chapter III · highlight');
    const button = markRow(
      highlightAt(40, 60),
      'k',
      () => {},
      () => {},
    );
    expect(button.querySelector('.mark-row__words')?.textContent).toBe('universally acknowledged');
    expect(button.querySelector('.mark-row__chapter')?.textContent).toBe('Chapter III · highlight');
    // No words kept: called by its chapter, as a bookmark is.
    expect(markName(highlightAt(40, 60, ''))).toBe('Chapter III');
  });

  it('has a name of its own beside a bookmark at its word, and beside a highlight that ends elsewhere', () => {
    const keys = [
      markKey(bookmarkAt(40)),
      markKey(highlightAt(40, 60)),
      markKey(highlightAt(40, 90)),
      markKey(highlightAt(60, 90)),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    // Its words aren't its name: read again differently, it's the same highlight.
    expect(markKey(highlightAt(40, 60, 'other words'))).toBe(keys[1]);
  });

  it('takes itself off by Delete, whichever kind it is', () => {
    for (const row of [bookmarkAt(40), highlightAt(40, 60)]) {
      const remove = vi.fn();
      const button = markRow(row, markKey(row), () => {}, remove);
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      expect(remove, row.kind).toHaveBeenCalledOnce();
    }
  });
});
