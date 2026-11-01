// A book's contents in the list (#40), in place of notes while the book is
// the one chosen on the shelf: its title and author, then its chapters in
// the book's order, the one on the page marked as an open note's row is.
// ↑ ↓ Home End move between them; Enter or a click opens one. A row is no
// note's: nothing drags it, and it has no menu. With Marks in the list
// (Phase 4c), its lenses under the head: Contents, or its marks, bookmarks
// and highlights (Phase 5b) (./book-lenses.ts).

import { h } from '../dom';
import {
  type BookLens,
  isLensKey,
  lensButtons,
  lensKey,
  type MarkRow,
  markKey,
  markRow,
  NO_MARKS,
} from './book-lenses';
import { type FoundModel, type FoundRow, foundKey, foundLine, foundRow } from './found-rows';
import { moveBetween } from './list';

export interface ContentsModel {
  readonly title: string;
  readonly author: string;
  readonly rows: readonly {
    readonly title: string;
    readonly depth: number;
    readonly spine: number;
  }[];
  /** The spine item on the page: its row is marked. */
  readonly spine: number;
  /** The lens shown. */
  readonly lens: BookLens;
  /** The book's marks (bookmarks and highlights) in its order; null for no lenses (Marks on the edge, Phase 4d). */
  readonly marks: readonly MarkRow[] | null;
  /** What the list's field finds in the book (Phase 5c); null while it searches nothing there. */
  readonly found: FoundModel | null;
}

/** What the list's rows do: a chapter opened, a lens chosen, a mark gone to or taken off. */
export interface ContentsActions {
  chapter(spine: number): void;
  lens(lens: BookLens): void;
  go(row: MarkRow): void;
  remove(row: MarkRow): void;
  /** A match's row chosen: its words shown and chosen on the page (Phase 5c). */
  goFound(row: FoundRow): void;
}

/** The words under the heading: "Jane Austen · 61 chapters". */
const countOf = (model: ContentsModel) => {
  const count = `${model.rows.length} ${model.rows.length === 1 ? 'chapter' : 'chapters'}`;
  return model.author ? `${model.author} · ${count}` : count;
};

/** A row's lasting name, in the list and under a book's row on SHELF: its spine item and title. */
export const chapterKey = (row: ContentsModel['rows'][number]): string =>
  `chapter:${row.spine}:${row.title}`;

/**
 * Which rows are marked as the chapter on the page: the first whose spine
 * item it is, as a part and its first chapter may start in one file.
 */
export function marked(model: Pick<ContentsModel, 'rows' | 'spine'>): boolean[] {
  const at = model.rows.findIndex((row) => row.spine === model.spine);
  return model.rows.map((_, i) => i === at);
}

/**
 * The lens the list shows: the one chosen, Found only while there's a search;
 * with Marks on the edge (no lenses), Found's rows in the contents' place
 * while the field searches, else the contents.
 */
export function lensShown(model: Pick<ContentsModel, 'lens' | 'marks' | 'found'>): BookLens {
  if (!model.marks) return model.found ? 'found' : 'contents';
  return model.lens === 'found' && !model.found ? 'contents' : model.lens;
}

/** The rows under Found: each match, then what the search says; or that alone. */
function foundRows(
  model: ContentsModel,
  found: FoundModel,
  actions: ContentsActions,
): HTMLElement[] {
  const line = foundLine(found);
  // Said once it's through, never at each chapter searched.
  const said =
    line &&
    h('p', { class: 'list__empty', text: line, attrs: found.done ? { role: 'status' } : {} });
  if (found.rows.length === 0) return said ? [said] : [];
  const rows = h(
    'ul',
    {
      class: 'rows rows--contents rows--found',
      attrs: { 'aria-label': `Found in ${model.title}` },
      on: { keydown: moveBetween('.contents-row') },
    },
    ...found.rows.map((row) =>
      h(
        'li',
        {},
        foundRow(row, foundKey(row), () => actions.goFound(row)),
      ),
    ),
  );
  return said ? [rows, said] : [rows];
}

/** The rows under Contents: the book's chapters, the one on the page marked. */
function chapterRows(model: ContentsModel, actions: ContentsActions): HTMLElement {
  const current = marked(model);
  return h(
    'ul',
    {
      class: 'rows rows--contents',
      attrs: { 'aria-label': `Contents of ${model.title}` },
      on: { keydown: moveBetween('.contents-row') },
    },
    ...model.rows.map((row, i) => {
      const item = h(
        'li',
        {},
        h(
          'button',
          {
            class: 'contents-row',
            attrs: {
              type: 'button',
              'data-key': chapterKey(row),
              'aria-current': current[i] ? 'true' : undefined,
            },
            on: { click: () => actions.chapter(row.spine) },
          },
          h('span', { class: 'contents-row__title', text: row.title }),
        ),
      );
      item.style.setProperty('--depth', String(row.depth));
      return item;
    }),
  );
}

/** The rows under Marks: each mark, or the line that says there are none. */
function markRows(model: ContentsModel, actions: ContentsActions): HTMLElement {
  const marks = model.marks ?? [];
  if (marks.length === 0) return h('p', { class: 'list__empty', text: NO_MARKS });
  return h(
    'ul',
    {
      class: 'rows rows--contents',
      attrs: { 'aria-label': `Marks in ${model.title}` },
      on: { keydown: moveBetween('.contents-row') },
    },
    ...marks.map((row) =>
      h(
        'li',
        {},
        markRow(
          row,
          markKey(row),
          () => actions.go(row),
          () => actions.remove(row),
        ),
      ),
    ),
  );
}

/** Draw `model` in the list's pane, with the window's news. */
export function renderContents(
  container: HTMLElement,
  model: ContentsModel,
  notice: string | null,
  actions: ContentsActions,
): void {
  const active = document.activeElement;
  const focused =
    active instanceof HTMLElement && container.contains(active) ? active.dataset.key : undefined;
  // Where among the rows the keyboard was: a row gone (a bookmark taken off) hands it to the one after.
  const rowsBefore = [...container.querySelectorAll<HTMLElement>('.contents-row')];
  const at = active instanceof HTMLElement ? rowsBefore.indexOf(active) : -1;
  const { marks, found } = model;
  const lens = lensShown(model);
  const counts = {
    contents: model.rows.length,
    marks: marks?.length ?? 0,
    found: found ? found.rows.length : null,
  };
  container.replaceChildren(
    h(
      'header',
      { class: 'list__head list__head--book' },
      h('h2', { class: 'list__heading', text: model.title }),
      h('p', { class: 'label list__count', text: countOf(model) }),
      ...(marks ? [lensButtons(lens, counts, (chosen) => actions.lens(chosen))] : []),
    ),
    h('p', {
      class: 'list__notice',
      text: notice ?? '',
      attrs: { role: 'status', hidden: !notice },
    }),
    ...(lens === 'found' && found
      ? foundRows(model, found, actions)
      : [lens === 'marks' ? markRows(model, actions) : chapterRows(model, actions)]),
  );
  if (focused === undefined) return;
  const same = [...container.querySelectorAll<HTMLElement>('[data-key]')].find(
    (control) => control.dataset.key === focused,
  );
  if (same) {
    same.focus();
    return;
  }
  // A lens gone (Found, its search cleared): the one shown now.
  if (isLensKey(focused)) {
    container.querySelector<HTMLElement>(`[data-key="${lensKey(lens)}"]`)?.focus();
    return;
  }
  if (at < 0) return;
  // Its row gone: the row now in its place, or the last, or with none left the lens it was under.
  const rows = [...container.querySelectorAll<HTMLElement>('.contents-row')];
  const next = rows[Math.min(at, rows.length - 1)];
  (next ?? container.querySelector<HTMLElement>(`[data-key="${lensKey(lens)}"]`))?.focus();
}
