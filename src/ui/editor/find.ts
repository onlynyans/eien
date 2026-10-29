// Find in the note, in the editor: what the window's find bar (../find/find-bar.ts)
// searches when it's over a note, and its keys.
//
// CodeMirror's search (@codemirror/search) keeps the query, highlights the
// matches and does the finding and replacing; each replace is one change,
// one step of the note's history (./note-doc.ts). Its panel would be drawn
// in the editor's shadow root, where the window's styles don't reach, so the
// panel CodeMirror asks for is an empty placeholder whose opening and closing
// show and hide the bar, the window's own, as the table's grips are.
//
// The keys run in the text and in the bar's fields alike (the 'search-panel'
// scope), and before the editor's other keys, so Esc in the text shuts the
// bar before it does anything else; in the bar, Esc is the bar's own.

import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  SearchQuery,
  search,
  searchPanelOpen,
  setSearchQuery,
} from '@codemirror/search';
import {
  EditorSelection,
  type Extension,
  Prec,
  type SelectionRange,
  type StateEffect,
} from '@codemirror/state';
import {
  type Command,
  EditorView,
  type KeyBinding,
  keymap,
  type Panel,
  runScopeHandlers,
  type ViewUpdate,
} from '@codemirror/view';
import { type FindCommandId, type FindCount, findKey } from '../../core/find';
import { FindBar } from '../find/find-bar';
import type { FindQuery, FindTarget } from '../find/find-target';
import { countMatches, firstMatchFrom } from './find-matches';
import { shownMatch } from './front-matter-hidden';

/** The keymap's scope for keys pressed in the bar's fields. */
const FIND_SCOPE = 'search-panel';

/** The bar's query as CodeMirror's search reads it. */
const toSearchQuery = (query: FindQuery): SearchQuery =>
  new SearchQuery({
    ...query,
    // A writer's \n is the two letters, unless it's a pattern.
    literal: true,
    // The front matter kept out of sight is neither found nor replaced.
    test: shownMatch,
  });

/** What the find bar searches over a note: CodeMirror's search in the editor's view. */
export class NoteFind implements FindTarget {
  readonly #view: () => EditorView;
  /** The bar, which the page lays over the sheet. */
  readonly bar: FindBar;

  constructor(view: () => EditorView) {
    this.#view = view;
    this.bar = new FindBar(this, 'Find in the note');
  }

  /**
   * The key held for the key being handled had Shift (set from each keydown,
   * in the text and in the bar): ⇧⌘G is the previous match however its G
   * arrives. CodeMirror reads Shift from a letter's case first, and with Caps
   * Lock (or a key sent as "g") it's ⌘G's lower-case g with Shift held.
   */
  shifted = false;

  /** ⌘G: the next match, or the previous one with Shift held. */
  step(): boolean {
    return this.shifted ? this.bar.previous() : this.bar.next();
  }

  /**
   * The panel CodeMirror's search asks for: an empty placeholder in the
   * editor, which shows the bar while it's mounted and keeps its count.
   */
  panel(_view: EditorView): Panel {
    return {
      dom: document.createElement('div'),
      top: true,
      mount: () => this.bar.shown(true),
      update: (update) => this.#updated(update),
      destroy: () => this.bar.shown(false),
    };
  }

  open(): void {
    const view = this.#view();
    if (!searchPanelOpen(view.state)) openSearchPanel(view);
  }

  close(): boolean {
    const view = this.#view();
    if (!closeSearchPanel(view)) return false;
    view.focus();
    return true;
  }

  chosen(): string {
    const { state } = this.#view();
    const { main } = state.selection;
    return state.sliceDoc(main.from, main.to);
  }

  valid(query: FindQuery): boolean {
    return toSearchQuery(query).valid;
  }

  query(query: FindQuery, narrow: boolean): void {
    const view = this.#view();
    const searched = toSearchQuery(query);
    const match = narrow
      ? firstMatchFrom(view.state, searched, view.state.selection.main.from)
      : null;
    if (!match) {
      view.dispatch({ effects: setSearchQuery.of(searched) });
      return;
    }
    const range = EditorSelection.range(match.from, match.to);
    view.dispatch({
      selection: EditorSelection.create([range]),
      effects: [setSearchQuery.of(searched), this.scrollTo(range)],
      userEvent: 'select.search',
    });
  }

  next(): boolean {
    return findNext(this.#view());
  }

  previous(): boolean {
    return findPrevious(this.#view());
  }

  count(): FindCount | 'invalid' {
    const { state } = this.#view();
    return countMatches(state, getSearchQuery(state));
  }

  readonly replace = {
    one: () => replaceNext(this.#view()),
    all: () => replaceAll(this.#view()),
    locked: () => this.#view().state.readOnly,
  };

  key(event: KeyboardEvent): boolean {
    this.shifted = event.shiftKey;
    return runScopeHandlers(this.#view(), event, FIND_SCOPE);
  }

  /** A match brought into sight clear of the bar, which lies over the page's top. */
  scrollTo(range: SelectionRange): StateEffect<unknown> {
    const { element } = this.bar;
    const clear = element.offsetHeight + element.offsetTop;
    return EditorView.scrollIntoView(range, { y: 'nearest', yMargin: Math.max(clear, 5) });
  }

  #updated(update: ViewUpdate): void {
    const queried = getSearchQuery(update.state) !== getSearchQuery(update.startState);
    const locked = update.state.readOnly !== update.startState.readOnly;
    if (update.docChanged || update.selectionSet || queried || locked) this.bar.changed();
  }
}

export function findInNote(find: NoteFind): Extension {
  const { bar } = find;
  const both = `editor ${FIND_SCOPE}`;
  const bind = (id: FindCommandId, run: Command, scope = both): KeyBinding => ({
    key: findKey(id, false),
    mac: findKey(id, true),
    run,
    scope,
    preventDefault: true,
  });
  return [
    search({
      top: true,
      literal: true,
      createPanel: (view) => find.panel(view),
      scrollToMatch: (range) => find.scrollTo(range),
    }),
    // Shift as held, before any keymap reads the key (NoteFind.shifted).
    Prec.highest(
      EditorView.domEventHandlers({
        keydown: (event) => {
          find.shifted = event.shiftKey;
          return false;
        },
      }),
    ),
    Prec.high(
      keymap.of([
        bind('find', () => bar.open(false)),
        bind('replace', () => bar.open(true)),
        bind('next', () => find.step()),
        bind('previous', () => bar.previous()),
        bind('replace-all', () => bar.replaceAll(), FIND_SCOPE),
        // In the text; in the bar's fields, Esc is the bar's own.
        { key: 'Escape', run: () => bar.close(), scope: 'editor' },
      ]),
    ),
    // The panel CodeMirror makes room for is the bar's placeholder: the bar is drawn outside.
    EditorView.theme({ '.cm-panels': { display: 'none' } }),
  ];
}
