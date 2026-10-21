// A new tag named in place (backlog #4): the + beside TAGS opens a field at
// the end of the tags, a "#" before it. Enter makes the tag (in
// .eien/tags.json, until notes carry it), Esc doesn't, and leaving the field
// makes it. A name that can't be a tag, or one there already, says so under
// the field, which stays open. What's typed outlives the sidebar's redraws.

import { tagKey, typedTag } from '../../core/tags';
import { h } from '../dom';
import { atDepth } from './depth';

export interface TagFieldEvents {
  /** Whether the sidebar is redrawing: a field it takes out isn't the writer leaving. */
  drawing(): boolean;
  /** The tags there now, by key: one of them can't be made again. */
  known(): ReadonlySet<string>;
  /** Done: the tag to make, or null for none. */
  done(tag: string | null): void;
}

const NOT_A_TAG = 'A tag is letters and numbers, - and _, with / to nest it.';

export class TagField {
  #editing: { typed: string; start: number; end: number } | null = null;
  readonly #events: TagFieldEvents;

  constructor(events: TagFieldEvents) {
    this.#events = events;
  }

  get active(): boolean {
    return this.#editing !== null;
  }

  start(): void {
    this.#editing = { typed: '', start: 0, end: 0 };
  }

  /** What's wrong with `typed`; null when it can be made. */
  problem(typed: string): string | null {
    const tag = typedTag(typed);
    if (!tag) return NOT_A_TAG;
    return this.#events.known().has(tagKey(tag)) ? `#${tag} is there already.` : null;
  }

  /** The field's rows (the field, and what's wrong under it), or none when no tag is being named. */
  rows(): HTMLElement[] {
    const editing = this.#editing;
    if (!editing) return [];
    const field = h('input', {
      class: 'field tree-row__field',
      attrs: { type: 'text', 'aria-label': 'New tag', placeholder: 'a tag', spellcheck: 'false' },
    });
    const said = h('li', { class: 'tree-hint tree-hint--problem', attrs: { role: 'status' } });
    field.value = editing.typed;
    const say = (text: string | null) => {
      said.textContent = text ?? '';
      said.hidden = text === null;
      field.setAttribute('aria-invalid', String(text !== null));
    };
    say(editing.typed.trim() ? this.problem(editing.typed) : null);
    const finish = (keep: boolean, byKey: boolean) => {
      if (!this.#editing) return;
      const typed = field.value;
      // Kept, but empty: nothing to make. Enter on a name that can't be made stays, saying why.
      if (keep && typed.trim() !== '') {
        const problem = this.problem(typed);
        if (problem && byKey) {
          say(problem);
          return;
        }
        if (problem) keep = false;
      }
      this.#editing = null;
      this.#events.done(keep && typed.trim() !== '' ? typedTag(typed) : null);
    };
    const keep = () => {
      if (!this.#editing) return;
      this.#editing.typed = field.value;
      this.#editing.start = field.selectionStart ?? field.value.length;
      this.#editing.end = field.selectionEnd ?? field.value.length;
    };
    field.addEventListener('input', () => {
      keep();
      say(field.value.trim() ? this.problem(field.value) : null);
    });
    field.addEventListener('select', keep);
    field.addEventListener('keyup', keep);
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(true, true);
      else if (event.key === 'Escape') finish(false, true);
      else return;
      event.preventDefault();
      event.stopPropagation();
    });
    field.addEventListener('blur', () => {
      if (!this.#events.drawing() && field.isConnected && document.hasFocus()) finish(true, false);
    });
    return [
      atDepth(
        h(
          'li',
          { class: 'tree-row tree-row--new' },
          h('span', { class: 'tree-row__twist' }),
          h('span', { class: 'tree-row__hash', text: '#' }),
          field,
        ),
        0,
      ),
      said,
    ];
  }

  /** After a redraw: the caret back in the field, where it was. */
  restore(within: HTMLElement): void {
    const editing = this.#editing;
    const field = within.querySelector<HTMLInputElement>('.tree-row--new .tree-row__field');
    if (!editing || !field || document.activeElement === field) return;
    field.focus();
    field.setSelectionRange(editing.start, editing.end);
  }
}
