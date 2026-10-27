// Find and replace in the open note (spec §4, Find in the note): a slip at
// the top of the page with the Find field, its count ("3 of 12"), three
// options (match case, whole word, a pattern), the moves to the previous and
// next match, and, unfolded, the Replace field with Replace and Replace all.
//
// CodeMirror's search (@codemirror/search) keeps the query, highlights the
// matches and does the finding and replacing; each replace is one change,
// one step of the note's history (./note-doc.ts). Its panel would be drawn
// in the editor's shadow root, where the window's styles don't reach, so the
// panel CodeMirror asks for is an empty placeholder whose opening and closing
// show and hide this bar, the window's own, as the table's grips are.

import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceAll,
  replaceNext,
  SearchQuery,
  searchPanelOpen,
  setSearchQuery,
} from '@codemirror/search';
import { EditorSelection, type SelectionRange, type StateEffect } from '@codemirror/state';
import { EditorView, type Panel, runScopeHandlers, type ViewUpdate } from '@codemirror/view';
import { countWords, type FindCommandId, findKey, findLabel } from '../../core/find';
import { h } from '../dom';
import type { IconName } from '../icons';
import { iconButton, quietButton } from '../quiet-button';
import { countMatches, firstMatchFrom } from './find-matches';
import { shownMatch } from './front-matter-hidden';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

/** The keymap's scope for keys pressed in the bar's fields (./find.ts). */
export const FIND_SCOPE = 'search-panel';

type Option = 'caseSensitive' | 'wholeWord' | 'regexp';
const OPTIONS: readonly { readonly id: Option; readonly icon: IconName; readonly label: string }[] =
  [
    { id: 'caseSensitive', icon: 'matchCase', label: 'Match case' },
    { id: 'wholeWord', icon: 'wholeWord', label: 'Whole word' },
    { id: 'regexp', icon: 'pattern', label: 'Pattern (regular expression)' },
  ];

/** The longest selection that seeds the Find field when it opens: a word or a phrase. */
const SEED_MAX = 100;

/** The bar's controls, made the first time it's asked for: most notes are never searched. */
interface Parts {
  readonly find: HTMLInputElement;
  readonly replace: HTMLInputElement;
  readonly count: HTMLElement;
  readonly options: ReadonlyMap<Option, HTMLButtonElement>;
  readonly twisty: HTMLButtonElement;
  readonly replaceTools: HTMLElement;
  readonly acts: readonly HTMLButtonElement[];
}

export class FindBar {
  readonly #view: () => EditorView;
  #parts: Parts | null = null;
  /** The slip, the window's own (not in the editor's shadow root); the page lays it over the sheet. */
  readonly element = h('div', {
    class: 'find quiet-row',
    attrs: { role: 'search', 'aria-label': 'Find in the note', hidden: true },
  });

  constructor(view: () => EditorView) {
    this.#view = view;
    this.element.addEventListener('keydown', (event) => this.#key(event));
  }

  get #p(): Parts {
    this.#parts ??= this.#build();
    return this.#parts;
  }

  #build(): Parts {
    const field = (label: string, more: string) =>
      h('input', {
        class: `field find__field ${more}`,
        attrs: { type: 'text', placeholder: label, 'aria-label': label, spellcheck: 'false' },
      });
    const find = field('Find', 'find__query');
    const replace = field('Replace', 'find__replace');
    const button = (id: FindCommandId, icon: IconName, run: () => void) =>
      iconButton({ label: findLabel(id), icon, keys: findKey(id, MAC), run });
    const twisty = quietButton({
      label: findLabel('replace'),
      icon: 'right',
      keys: findKey('replace', MAC),
      class: 'find__twisty',
      run: () => this.#showReplace(!this.#replaceShown, true),
    });
    const options = new Map<Option, HTMLButtonElement>();
    for (const { id, icon, label } of OPTIONS) {
      const toggle = quietButton({ label, icon, run: () => this.#toggle(id) });
      toggle.setAttribute('aria-pressed', 'false');
      options.set(id, toggle);
    }
    const acts = [
      button('replace-one', 'replace', () => this.replaceOne()),
      button('replace-all', 'replaceAll', () => this.replaceAll()),
    ];
    const parts: Parts = {
      find,
      replace,
      count: h('span', { class: 'find__count count', attrs: { role: 'status' } }),
      options,
      twisty,
      replaceTools: h('span', { class: 'find__acts' }, ...acts),
      acts,
    };
    this.element.append(
      twisty,
      find,
      parts.count,
      h('span', { class: 'find__options' }, ...options.values()),
      h(
        'span',
        { class: 'find__moves' },
        button('previous', 'up', () => this.previous()),
        button('next', 'down', () => this.next()),
        iconButton({ label: 'Close', icon: 'close', keys: 'Escape', run: () => this.close() }),
      ),
      replace,
      parts.replaceTools,
    );
    find.addEventListener('input', () => this.#typed());
    replace.addEventListener('input', () => this.#setQuery());
    this.#parts = parts;
    this.#showReplace(false, false);
    return parts;
  }

  /**
   * The panel CodeMirror's search asks for: an empty placeholder in the
   * editor, which shows this bar while it's mounted and keeps its count.
   */
  panel(_view: EditorView): Panel {
    return {
      dom: document.createElement('div'),
      top: true,
      mount: () => {
        this.element.hidden = false;
        this.#render();
      },
      update: (update) => this.#updated(update),
      destroy: () => {
        this.element.hidden = true;
      },
    };
  }

  get isOpen(): boolean {
    return searchPanelOpen(this.#view().state);
  }

  /**
   * Open the bar (with Replace unfolded, for `replace`), seeded with the
   * chosen words if there are some, the keyboard in its field.
   */
  open(replace: boolean): boolean {
    const view = this.#view();
    const { main } = view.state.selection;
    const chosen = view.state.sliceDoc(main.from, main.to);
    if (chosen && main.to - main.from <= SEED_MAX && !chosen.includes('\n'))
      this.#p.find.value = this.#pressed('regexp') ? escapePattern(chosen) : chosen;
    if (replace) this.#showReplace(true, false);
    if (!searchPanelOpen(view.state)) openSearchPanel(view);
    this.#setQuery();
    const field = replace && this.#p.find.value ? this.#p.replace : this.#p.find;
    field.focus();
    field.select();
    return true;
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
    return this.shifted ? this.previous() : this.next();
  }

  next(): boolean {
    return this.#query().valid ? findNext(this.#view()) : this.open(false);
  }

  previous(): boolean {
    return this.#query().valid ? findPrevious(this.#view()) : this.open(false);
  }

  /** The current match replaced, and on to the next (the first press only goes to one). */
  replaceOne(): boolean {
    return replaceNext(this.#view());
  }

  replaceAll(): boolean {
    return replaceAll(this.#view());
  }

  /** Shut the bar; the keyboard goes back to the text, on the current match. */
  close(): boolean {
    const view = this.#view();
    if (!closeSearchPanel(view)) return false;
    view.focus();
    return true;
  }

  /** A match brought into sight clear of the bar, which lies over the page's top. */
  scrollTo(range: SelectionRange): StateEffect<unknown> {
    const clear = this.element.offsetHeight + this.element.offsetTop;
    return EditorView.scrollIntoView(range, { y: 'nearest', yMargin: Math.max(clear, 5) });
  }

  #query(): SearchQuery {
    return new SearchQuery({
      search: this.#p.find.value,
      replace: this.#p.replace.value,
      caseSensitive: this.#pressed('caseSensitive'),
      wholeWord: this.#pressed('wholeWord'),
      regexp: this.#pressed('regexp'),
      // A writer's \n is the two letters, unless it's a pattern.
      literal: true,
      // The front matter kept out of sight is neither found nor replaced.
      test: shownMatch,
    });
  }

  #setQuery(): void {
    this.#view().dispatch({ effects: setSearchQuery.of(this.#query()) });
  }

  /** The query changed: each letter narrows from the same match, rather than stepping past it. */
  #typed(): void {
    const view = this.#view();
    const query = this.#query();
    const match = firstMatchFrom(view.state, query, view.state.selection.main.from);
    if (!match) {
      view.dispatch({ effects: setSearchQuery.of(query) });
      return;
    }
    const range = EditorSelection.range(match.from, match.to);
    view.dispatch({
      selection: EditorSelection.create([range]),
      effects: [setSearchQuery.of(query), this.scrollTo(range)],
      userEvent: 'select.search',
    });
  }

  #pressed(option: Option): boolean {
    return this.#p.options.get(option)?.getAttribute('aria-pressed') === 'true';
  }

  #toggle(option: Option): void {
    const button = this.#p.options.get(option);
    button?.setAttribute('aria-pressed', String(!this.#pressed(option)));
    this.#typed();
  }

  get #replaceShown(): boolean {
    return this.#p.twisty.getAttribute('aria-expanded') === 'true';
  }

  #showReplace(shown: boolean, focus: boolean): void {
    this.#p.twisty.setAttribute('aria-expanded', String(shown));
    this.element.toggleAttribute('data-replace', shown);
    this.#p.replace.hidden = this.#p.replaceTools.hidden = !shown;
    if (focus) (shown ? this.#p.replace : this.#p.find).focus();
  }

  /** A key anywhere in the bar: the find keymap's (./find.ts) first, then Enter's own in a field. */
  #key(event: KeyboardEvent): void {
    if (event.isComposing) return;
    this.shifted = event.shiftKey;
    if (runScopeHandlers(this.#view(), event, FIND_SCOPE)) {
      event.preventDefault();
      return;
    }
    if (event.key !== 'Enter' || event.altKey || event.metaKey || event.ctrlKey) return;
    if (event.target === this.#p.replace) this.replaceOne();
    else if (event.target !== this.#p.find) return;
    else if (event.shiftKey) this.previous();
    else this.next();
    event.preventDefault();
  }

  #updated(update: ViewUpdate): void {
    const queried = getSearchQuery(update.state) !== getSearchQuery(update.startState);
    const locked = update.state.readOnly !== update.startState.readOnly;
    if (update.docChanged || update.selectionSet || queried || locked) this.#render();
  }

  /** The count, a pattern that can't be read, and Replace off where the text can't change. */
  #render(): void {
    const { state } = this.#view();
    const count = countMatches(state, getSearchQuery(state));
    this.#p.count.textContent = countWords(this.#p.find.value, count);
    if (count === 'invalid') this.#p.find.setAttribute('aria-invalid', 'true');
    else this.#p.find.removeAttribute('aria-invalid');
    this.#p.replace.disabled = state.readOnly;
    for (const act of this.#p.acts) act.disabled = state.readOnly;
  }
}

/** Chosen words, as a pattern that matches them as written. */
const escapePattern = (words: string): string => words.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
