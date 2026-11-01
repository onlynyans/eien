// Find, and in a note replace (spec §4, Find in the note): a slip at the top
// of the page with the Find field, its count ("3 of 12"), three options
// (match case, whole word, a pattern), the moves to the previous and next
// match, and, where the text can change and unfolded, the Replace field with
// Replace and Replace all.
//
// The bar is the window's own and searches nothing itself: what it
// searches (a `FindTarget`, ./find-target.ts) finds, counts, highlights and
// replaces, and tells the bar when it's shown and when its count may have
// moved. A note's is CodeMirror's search (../editor/find.ts); a book's
// (#40, Phase 5c, ../epub/book-find.ts) searches the whole book, with no
// Replace.

import { countWords, escapePattern, type FindCommandId, findKey, findLabel } from '../../core/find';
import { h } from '../dom';
import type { IconName } from '../icons';
import { iconButton, quietButton } from '../quiet-button';
import type { FindQuery, FindTarget } from './find-target';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);

type Option = 'caseSensitive' | 'wholeWord' | 'regexp';
const OPTIONS: readonly { readonly id: Option; readonly icon: IconName; readonly label: string }[] =
  [
    { id: 'caseSensitive', icon: 'matchCase', label: 'Match case' },
    { id: 'wholeWord', icon: 'wholeWord', label: 'Whole word' },
    { id: 'regexp', icon: 'pattern', label: 'Pattern (regular expression)' },
  ];

/** The longest selection that seeds the Find field when it opens: a word or a phrase. */
const SEED_MAX = 100;

/** Replace's controls, unfolded by the twisty. */
interface ReplaceParts {
  readonly field: HTMLInputElement;
  readonly twisty: HTMLButtonElement;
  readonly tools: HTMLElement;
  readonly acts: readonly HTMLButtonElement[];
}

/** The bar's controls, made the first time it's asked for: most notes are never searched. */
interface Parts {
  readonly find: HTMLInputElement;
  readonly count: HTMLElement;
  readonly options: ReadonlyMap<Option, HTMLButtonElement>;
  /** Null where the target can't replace. */
  readonly replace: ReplaceParts | null;
}

export class FindBar {
  readonly #target: FindTarget;
  #parts: Parts | null = null;
  /** The slip, the window's own (not in the editor's shadow root); the page lays it over the sheet. */
  readonly element: HTMLElement;

  /** `label`, what the bar is called: "Find in the note". */
  constructor(target: FindTarget, label: string) {
    this.#target = target;
    this.element = h('div', {
      class: 'find quiet-row',
      attrs: { role: 'search', 'aria-label': label, hidden: true },
    });
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
    const button = (id: FindCommandId, icon: IconName, run: () => void) =>
      iconButton({ label: findLabel(id), icon, keys: findKey(id, MAC), run });
    const find = field('Find', 'find__query');
    const options = new Map<Option, HTMLButtonElement>();
    for (const { id, icon, label } of OPTIONS) {
      const toggle = quietButton({ label, icon, run: () => this.#toggle(id) });
      toggle.setAttribute('aria-pressed', 'false');
      options.set(id, toggle);
    }
    const replace = this.#target.replace ? this.#buildReplace(field, button) : null;
    const parts: Parts = {
      find,
      count: h('span', { class: 'find__count count', attrs: { role: 'status' } }),
      options,
      replace,
    };
    this.element.append(
      ...(replace ? [replace.twisty] : []),
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
      ...(replace ? [replace.field, replace.tools] : []),
    );
    find.addEventListener('input', () => this.#typed());
    replace?.field.addEventListener('input', () => this.#setQuery());
    this.#parts = parts;
    this.#showReplace(false, false);
    return parts;
  }

  #buildReplace(
    field: (label: string, more: string) => HTMLInputElement,
    button: (id: FindCommandId, icon: IconName, run: () => void) => HTMLButtonElement,
  ): ReplaceParts {
    const acts = [
      button('replace-one', 'replace', () => this.replaceOne()),
      button('replace-all', 'replaceAll', () => this.replaceAll()),
    ];
    return {
      field: field('Replace', 'find__replace'),
      twisty: quietButton({
        label: findLabel('replace'),
        icon: 'right',
        keys: findKey('replace', MAC),
        class: 'find__twisty',
        run: () => this.#showReplace(!this.#replaceShown, true),
      }),
      tools: h('span', { class: 'find__acts' }, ...acts),
      acts,
    };
  }

  /** The target's matches shown (true) or hidden: the bar with them. */
  shown(open: boolean): void {
    this.element.hidden = !open;
    if (open) this.#render();
  }

  /** The target's text, selection or lock moved: the count again. */
  changed(): void {
    this.#render();
  }

  /**
   * Open the bar (with Replace unfolded, for `replace`, where the target
   * replaces), seeded with the chosen words if there are some, the keyboard
   * in its field.
   */
  open(replace: boolean): boolean {
    const chosen = this.#target.chosen();
    // Seeded before the target shows its matches: the count it renders then reads the field.
    if (chosen && chosen.length <= SEED_MAX && !chosen.includes('\n'))
      this.#p.find.value = this.#pressed('regexp') ? escapePattern(chosen) : chosen;
    const unfolded = replace ? this.#p.replace : null;
    if (unfolded) this.#showReplace(true, false);
    this.#target.open();
    this.#setQuery();
    const field = unfolded && this.#p.find.value ? unfolded.field : this.#p.find;
    field.focus();
    field.select();
    return true;
  }

  next(): boolean {
    return this.#target.valid(this.#query()) ? this.#target.next() : this.open(false);
  }

  previous(): boolean {
    return this.#target.valid(this.#query()) ? this.#target.previous() : this.open(false);
  }

  /** The current match replaced, and on to the next (the first press only goes to one). */
  replaceOne(): boolean {
    return this.#target.replace?.one() ?? false;
  }

  replaceAll(): boolean {
    return this.#target.replace?.all() ?? false;
  }

  /** Shut the bar; the keyboard goes back to the text, on the current match. */
  close(): boolean {
    return this.#target.close();
  }

  #query(): FindQuery {
    return {
      search: this.#p.find.value,
      replace: this.#p.replace?.field.value ?? '',
      caseSensitive: this.#pressed('caseSensitive'),
      wholeWord: this.#pressed('wholeWord'),
      regexp: this.#pressed('regexp'),
    };
  }

  #setQuery(): void {
    this.#target.query(this.#query(), false);
  }

  #typed(): void {
    this.#target.query(this.#query(), true);
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
    return this.#p.replace?.twisty.getAttribute('aria-expanded') === 'true';
  }

  #showReplace(shown: boolean, focus: boolean): void {
    const replace = this.#p.replace;
    if (!replace) return;
    replace.twisty.setAttribute('aria-expanded', String(shown));
    this.element.toggleAttribute('data-replace', shown);
    replace.field.hidden = replace.tools.hidden = !shown;
    if (focus) (shown ? replace.field : this.#p.find).focus();
  }

  /** A key anywhere in the bar: the target's own keys first, then Esc's and Enter's. */
  #key(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (this.#target.key?.(event)) {
      event.preventDefault();
      return;
    }
    const plain = !(event.altKey || event.metaKey || event.ctrlKey);
    if (event.key === 'Escape' && plain && !event.shiftKey) {
      // Taken, so a phone's Back that presses Esc (../vault/phone-view.ts) knows the bar shut.
      if (this.close()) event.preventDefault();
      return;
    }
    if (event.key !== 'Enter' || !plain) return;
    if (event.target === this.#p.replace?.field) this.replaceOne();
    else if (event.target !== this.#p.find) return;
    else if (event.shiftKey) this.previous();
    else this.next();
    event.preventDefault();
  }

  /** The count, a pattern that can't be read, and Replace off where the text can't change. */
  #render(): void {
    const count = this.#target.count();
    this.#p.count.textContent = countWords(this.#p.find.value, count);
    if (count === 'invalid') this.#p.find.setAttribute('aria-invalid', 'true');
    else this.#p.find.removeAttribute('aria-invalid');
    const replace = this.#p.replace;
    if (!replace) return;
    const locked = this.#target.replace?.locked() ?? true;
    replace.field.disabled = locked;
    for (const act of replace.acts) act.disabled = locked;
  }
}
