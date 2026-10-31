// A book's Found in the list (#40, Phase 5c): every match a row in its words
// with its page and chapter, the match marked; the lens's count, and what it
// says while searching (heard once it's through), with none, or with more;
// with Marks on the edge, Found's rows in the contents' place.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { COUNT_LIMIT } from '../../core/find';
import { type ContentsModel, lensShown, renderContents } from './contents-list';
import { type FoundModel, type FoundRow, foundKey, foundLine } from './found-rows';

const ROW: FoundRow = {
  spine: 2,
  from: 40,
  to: 46,
  before: '…said his lady to Mr. ',
  words: 'Bennet',
  after: ' one day…',
  page: '3',
  chapter: 'Chapter I',
};

const found = (over: Partial<FoundModel> = {}): FoundModel => ({
  rows: [ROW],
  words: 'Bennet',
  title: 'Pride and Prejudice',
  searched: 3,
  chapters: 3,
  done: true,
  more: false,
  ...over,
});

const model = (over: Partial<ContentsModel> = {}): ContentsModel => ({
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  rows: [{ title: 'Chapter I', depth: 0, spine: 1 }],
  spine: 1,
  lens: 'found',
  marks: [],
  found: found(),
  ...over,
});

function drawn(shown: ContentsModel) {
  const container = document.body.appendChild(document.createElement('section'));
  const actions = {
    chapter: vi.fn(),
    lens: vi.fn(),
    go: vi.fn(),
    remove: vi.fn(),
    goFound: vi.fn(),
  };
  renderContents(container, shown, null, actions);
  return { container, actions };
}

afterEach(() => document.body.replaceChildren());

describe('a book’s Found in the list', () => {
  it('shows each match in its words, the match marked, its page and its chapter; a click goes there', () => {
    const { container, actions } = drawn(model());
    const row = container.querySelector<HTMLButtonElement>('.found-row');
    expect(row?.querySelector('.mark-row__words')?.textContent).toBe(
      '…said his lady to Mr. Bennet one day…',
    );
    expect(row?.querySelector('.found-row__match')?.textContent).toBe('Bennet');
    expect(row?.querySelector('.mark-row__page')?.textContent).toBe('3');
    expect(row?.querySelector('.mark-row__chapter')?.textContent).toBe('Chapter I');
    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe(
      'Found in Pride and Prejudice',
    );
    row?.click();
    expect(actions.goFound).toHaveBeenCalledWith(ROW);
  });

  it('counts what it found on its lens, pressed, and says it while it searches, never as a live line', () => {
    const { container } = drawn(model({ found: found({ done: false, searched: 1 }) }));
    const lens = [...container.querySelectorAll<HTMLButtonElement>('.book-lens')][2];
    expect(lens?.textContent).toBe('Found 1');
    expect(lens?.getAttribute('aria-pressed')).toBe('true');
    const line = container.querySelector('.list__empty');
    expect(line?.textContent).toBe('Searching… chapter 2 of 3');
    expect(line?.getAttribute('role')).toBeNull();
  });

  it('says none was found, heard once it’s through', () => {
    const { container } = drawn(model({ found: found({ rows: [] }) }));
    const line = container.querySelector('.list__empty');
    expect(line?.textContent).toBe('No “Bennet” in Pride and Prejudice.');
    expect(line?.getAttribute('role')).toBe('status');
  });

  it('says there are more than it shows', () => {
    expect(foundLine(found({ more: true }))).toBe(
      `More than ${COUNT_LIMIT.toLocaleString('en')}: type more to narrow it.`,
    );
    expect(foundLine(found())).toBeNull();
  });

  it('shows Contents with no search, whatever lens was chosen, and Found in the contents’ place on the edge', () => {
    expect(lensShown({ lens: 'found', marks: [], found: null })).toBe('contents');
    expect(lensShown({ lens: 'marks', marks: [], found: found() })).toBe('marks');
    expect(lensShown({ lens: 'contents', marks: null, found: found() })).toBe('found');
    expect(lensShown({ lens: 'marks', marks: null, found: null })).toBe('contents');
  });

  it('names each row by its place, the keyboard kept on it across a redraw', () => {
    const keys = [
      foundKey(ROW),
      foundKey({ ...ROW, from: 41 }),
      foundKey({ ...ROW, to: 47 }),
      foundKey({ ...ROW, spine: 3 }),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    const { container } = drawn(model());
    container.querySelector<HTMLButtonElement>('.found-row')?.focus();
    renderContents(container, model({ found: found({ rows: [ROW] }) }), null, {
      chapter: vi.fn(),
      lens: vi.fn(),
      go: vi.fn(),
      remove: vi.fn(),
      goFound: vi.fn(),
    });
    expect(document.activeElement?.classList.contains('found-row')).toBe(true);
  });
});
