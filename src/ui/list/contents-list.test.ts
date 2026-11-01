import { describe, expect, it, vi } from 'vitest';
import type { BookLens, MarkRow } from './book-lenses';
import { NO_MARKS } from './book-lenses';
import { type ContentsModel, renderContents } from './contents-list';

const MODEL: ContentsModel = {
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  rows: [
    { title: 'Volume I', depth: 0, spine: 1 },
    { title: 'Chapter I', depth: 1, spine: 1 },
    { title: 'Chapter II', depth: 1, spine: 2 },
  ],
  spine: 1,
  lens: 'contents',
  marks: null,
};

function drawn(model = MODEL) {
  const container = document.body.appendChild(document.createElement('section'));
  const choose = vi.fn();
  const actions = { chapter: choose, lens: vi.fn(), go: vi.fn(), remove: vi.fn() };
  renderContents(container, model, null, actions);
  return { container, choose, actions };
}

const rows = (container: HTMLElement) => [
  ...container.querySelectorAll<HTMLButtonElement>('.contents-row'),
];

describe('a book’s contents in the list', () => {
  it('heads the list with the book, its author and how many chapters', () => {
    const { container } = drawn();
    expect(container.querySelector('.list__heading')?.textContent).toBe('Pride and Prejudice');
    expect(container.querySelector('.list__count')?.textContent).toBe('Jane Austen · 3 chapters');
    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe(
      'Contents of Pride and Prejudice',
    );
  });

  it('marks once the chapter on the page, though two rows start in its file', () => {
    const { container } = drawn();
    expect(rows(container).map((row) => row.getAttribute('aria-current'))).toEqual([
      'true',
      null,
      null,
    ]);
  });

  it('opens a row’s chapter by click, and moves between rows by arrow keys', () => {
    const { container, choose } = drawn();
    const [, one, two] = rows(container);
    two?.click();
    expect(choose).toHaveBeenCalledWith(2);
    one?.focus();
    one?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(two);
    two?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(document.activeElement).toBe(rows(container)[0]);
  });

  it('keeps the keyboard on its row through a redraw', () => {
    const { container, actions } = drawn();
    rows(container)[2]?.focus();
    renderContents(container, { ...MODEL, spine: 2 }, null, actions);
    expect(document.activeElement).toBe(rows(container)[2]);
    expect(rows(container)[2]?.getAttribute('aria-current')).toBe('true');
  });

  it('says “1 chapter”, and leaves out an author the book doesn’t name', () => {
    const { container } = drawn({
      ...MODEL,
      author: '',
      rows: [{ title: 'Only', depth: 0, spine: 0 }],
    });
    expect(container.querySelector('.list__count')?.textContent).toBe('1 chapter');
  });
});

describe('a book’s lenses in the list (Phase 4c)', () => {
  const ROWS: MarkRow[] = [
    {
      kind: 'bookmark' as const,
      offset: 40,
      mark: { chapter: 'c1.xhtml', offset: 40, words: 'It is a truth universally acknowledged' },
      spine: 1,
      page: '3',
      chapter: 'Chapter I',
    },
    {
      kind: 'bookmark' as const,
      offset: 0,
      mark: { chapter: 'c2.xhtml', offset: 0, words: '' },
      spine: 2,
      page: null,
      chapter: 'Chapter II',
    },
  ];
  const withMarks = (lens: BookLens, marks: readonly MarkRow[] = ROWS): ContentsModel => ({
    ...MODEL,
    lens,
    marks,
  });
  const lenses = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLButtonElement>('.book-lens'),
  ];

  it('are Contents and Marks under the head, each with its count, the one shown pressed', () => {
    const { container } = drawn(withMarks('contents'));
    // A space between the name and its count: a screen reader says "Marks 2", as the eye reads it.
    expect(lenses(container).map((lens) => lens.textContent)).toEqual(['Contents 3', 'Marks 2']);
    expect(lenses(container).map((lens) => lens.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
    ]);
    expect(container.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'The book’s index',
    );
  });

  it('choose the other with a click, the keyboard staying on it through the redraw', () => {
    const { container, actions } = drawn(withMarks('contents'));
    lenses(container)[1]?.focus();
    lenses(container)[1]?.click();
    expect(actions.lens).toHaveBeenLastCalledWith('marks');
    renderContents(container, withMarks('marks'), null, actions);
    expect(document.activeElement).toBe(lenses(container)[1]);
  });

  it('show each bookmark under Marks: its words, its page, its chapter; it goes there, or Delete takes it off', () => {
    const { container, actions } = drawn(withMarks('marks'));
    const [first, second] = rows(container);
    expect(first?.querySelector('.mark-row__words')?.textContent).toBe(
      'It is a truth universally acknowledged',
    );
    expect(first?.querySelector('.mark-row__page')?.textContent).toBe('3');
    expect(first?.querySelector('.mark-row__chapter')?.textContent).toBe('Chapter I · bookmark');
    // No words kept: called by its chapter.
    expect(second?.querySelector('.mark-row__words')?.textContent).toBe('Chapter II');
    first?.click();
    expect(actions.go).toHaveBeenCalledWith(ROWS[0]);
    second?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
    expect(actions.remove).toHaveBeenCalledWith(ROWS[1]);
    expect(actions.chapter).not.toHaveBeenCalled();
  });

  it('take one off once for a key held, and never for ⌘⌫ (a row’s trash elsewhere)', () => {
    const { container, actions } = drawn(withMarks('marks'));
    const [first] = rows(container);
    const key = (init: KeyboardEventInit) =>
      first?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    key({ key: 'Backspace', repeat: true });
    key({ key: 'Backspace', metaKey: true });
    key({ key: 'Delete', ctrlKey: true });
    expect(actions.remove).not.toHaveBeenCalled();
    key({ key: 'Backspace' });
    expect(actions.remove).toHaveBeenCalledOnce();
  });

  it('hand the keyboard to the next row when one is taken off, and to Marks when none is left', () => {
    const { container, actions } = drawn(withMarks('marks'));
    rows(container)[0]?.focus();
    renderContents(container, withMarks('marks', ROWS.slice(1)), null, actions);
    expect(document.activeElement).toBe(rows(container)[0]);
    renderContents(container, withMarks('marks', []), null, actions);
    expect(document.activeElement).toBe(lenses(container)[1]);
  });

  it('say so when none is kept', () => {
    const { container } = drawn(withMarks('marks', []));
    expect(rows(container)).toHaveLength(0);
    expect(container.querySelector('.list__empty')?.textContent).toBe(NO_MARKS);
  });

  it('aren’t there when the marks are on the page’s edge', () => {
    const off = drawn({ ...MODEL, lens: 'marks', marks: null });
    expect(lenses(off.container)).toHaveLength(0);
    expect(rows(off.container)).toHaveLength(3);
  });
});

describe('a book’s Marks in the list, as QA tried them (Phase 4c)', () => {
  /** `count` bookmarks in one chapter, a page each. */
  const many = (count: number): MarkRow[] =>
    Array.from({ length: count }, (_, i) => ({
      kind: 'bookmark' as const,
      offset: i * 100,
      mark: { chapter: 'c1.xhtml', offset: i * 100, words: `Bookmark ${i}` },
      spine: 1,
      page: String(i + 1),
      chapter: 'Chapter I',
    }));
  const marksOf = (marks: readonly MarkRow[]): ContentsModel => ({
    ...MODEL,
    lens: 'marks',
    marks,
  });
  const words = (container: HTMLElement) =>
    rows(container).map((row) => row.querySelector('.mark-row__words')?.textContent);

  it('are a list of their own, named for the book, that the arrow keys move through', () => {
    const { container } = drawn(marksOf(many(3)));
    expect(container.querySelector('ul')?.getAttribute('aria-label')).toBe(
      'Marks in Pride and Prejudice',
    );
    const [first, second, third] = rows(container);
    first?.focus();
    first?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(second);
    second?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(third);
  });

  it('hand the keyboard to the row after one taken off from the middle', () => {
    const marks = many(3);
    const { container, actions } = drawn(marksOf(marks));
    rows(container)[1]?.focus();
    renderContents(container, marksOf([marks[0], marks[2]] as MarkRow[]), null, actions);
    expect(document.activeElement).toBe(rows(container)[1]);
    expect(words(container)).toEqual(['Bookmark 0', 'Bookmark 2']);
  });

  it('hand it to the row now last when the last is taken off', () => {
    const marks = many(3);
    const { container, actions } = drawn(marksOf(marks));
    rows(container)[2]?.focus();
    renderContents(container, marksOf(marks.slice(0, 2)), null, actions);
    expect(document.activeElement).toBe(rows(container)[1]);
  });

  it('leave the keyboard where it was when the list is drawn again with nothing taken off', () => {
    const marks = many(3);
    const { container, actions } = drawn(marksOf(marks));
    rows(container)[1]?.focus();
    // The book counted meanwhile: the pages change, the rows stay.
    renderContents(
      container,
      marksOf(marks.map((row) => ({ ...row, page: `${row.page}0` }))),
      null,
      actions,
    );
    expect(document.activeElement).toBe(rows(container)[1]);
    expect(rows(container)[1]?.querySelector('.mark-row__page')?.textContent).toBe('20');
  });

  it('never take the keyboard when it’s elsewhere', () => {
    const marks = many(2);
    const { container, actions } = drawn(marksOf(marks));
    const outside = document.body.appendChild(document.createElement('button'));
    // Named as a lens is (another pane's lenses, say): only one in the list may take the keyboard back.
    outside.dataset.key = 'lens:marks';
    outside.focus();
    renderContents(container, marksOf(marks.slice(1)), null, actions);
    expect(document.activeElement).toBe(outside);
  });

  it('draw every one of a thousand bookmarks (the most a book’s file shows), Delete on one taking off that one', () => {
    const marks = many(1000);
    const { container, actions } = drawn(marksOf(marks));
    expect(rows(container)).toHaveLength(1000);
    expect(new Set(rows(container).map((row) => row.dataset.key)).size).toBe(1000);
    expect(container.querySelectorAll('.book-lens')[1]?.textContent).toBe('Marks 1000');
    rows(container)[500]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
    );
    expect(actions.remove).toHaveBeenCalledExactlyOnceWith(marks[500]);
    rows(container)[500]?.focus();
    renderContents(container, marksOf(marks.filter((_, i) => i !== 500)), null, actions);
    expect(document.activeElement?.querySelector('.mark-row__words')?.textContent).toBe(
      'Bookmark 501',
    );
  });
});

// QA (#40, Phase 5b): a book's marks of both kinds in the list, a bookmark and
// a highlight at one word among them.
describe('a book’s Marks of both kinds, as QA tried them (Phase 5b)', () => {
  const bookmarkAt = (offset: number, words: string): MarkRow => ({
    kind: 'bookmark',
    offset,
    mark: { chapter: 'c1.xhtml', offset, words },
    spine: 1,
    page: '3',
    chapter: 'Chapter I',
  });
  const highlightAt = (from: number, words: string): MarkRow => ({
    kind: 'highlight',
    offset: from,
    mark: { chapter: 'c1.xhtml', from, to: from + 20, words },
    spine: 1,
    page: '3',
    chapter: 'Chapter I',
  });
  const BOTH = [bookmarkAt(40, 'Its page'), highlightAt(40, 'Its words'), highlightAt(90, 'Later')];
  const marksOf = (marks: readonly MarkRow[]): ContentsModel => ({
    ...MODEL,
    lens: 'marks',
    marks,
  });
  const words = (container: HTMLElement) =>
    rows(container).map((row) => row.querySelector('.mark-row__words')?.textContent);

  it('are each a row in the order given, its kind said, counted together under Marks', () => {
    const { container, actions } = drawn(marksOf(BOTH));
    expect(words(container)).toEqual(['Its page', 'Its words', 'Later']);
    expect(
      rows(container).map((row) => row.querySelector('.mark-row__chapter')?.textContent),
    ).toEqual(['Chapter I · bookmark', 'Chapter I · highlight', 'Chapter I · highlight']);
    expect(new Set(rows(container).map((row) => row.dataset.key)).size).toBe(3);
    expect(container.querySelectorAll('.book-lens')[1]?.textContent).toBe('Marks 3');
    rows(container)[1]?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
    );
    expect(actions.remove).toHaveBeenCalledExactlyOnceWith(BOTH[1]);
  });

  it('keep the keyboard on a highlight’s row, never the bookmark’s at its word, as rows come and go', () => {
    const { container, actions } = drawn(marksOf(BOTH));
    rows(container)[1]?.focus();
    // A bookmark made before it: the highlight's row moves down, the keyboard with it.
    renderContents(container, marksOf([bookmarkAt(0, 'First'), ...BOTH]), null, actions);
    expect(document.activeElement?.querySelector('.mark-row__words')?.textContent).toBe(
      'Its words',
    );
    // The bookmark at its word taken off: the keyboard stays on the highlight.
    renderContents(container, marksOf(BOTH.slice(1)), null, actions);
    expect(document.activeElement?.querySelector('.mark-row__words')?.textContent).toBe(
      'Its words',
    );
  });
});
