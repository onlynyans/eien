// The note's tags on the page (backlog #13; docs/design/explorations/tags.md):
// each as a mono word, a × to take off those in front matter, a dot on
// those typed in the text (which have no ×: they live in the words, and
// choosing one shows where). The + (or # on the page) opens a field whose
// menu lists the vault's tags, then "Make #…". Where it sits is the
// layout's (../chrome/layout-spec.ts, TagSlot); it knows nothing of that.

import type { NoteTags } from '../../core/note';
import { type TagChoice, tagKey } from '../../core/tags';
import { h } from '../dom';
import { icon } from '../icons';

export interface TagSetOf {
  /** What the field offers for `typed`, to a note with `has`. */
  choices(typed: string, has: readonly string[]): readonly TagChoice[];
  add(tag: string): void;
  remove(tag: string): void;
  /** Show where the tag typed in the text is. */
  find(tag: string): void;
}

let lists = 0;

export class TagSet {
  readonly element = h('div', { class: 'tag-set', attrs: { role: 'group', 'aria-label': 'Tags' } });
  readonly #of: TagSetOf;
  readonly #add = h(
    'button',
    {
      class: 'icon-button tag-set__add',
      attrs: {
        type: 'button',
        'aria-label': 'Add a tag',
        'data-tip': 'Add a tag',
        'data-shortcut': '#',
        'aria-keyshortcuts': '#',
        'data-key': 'page-tags:add',
      },
      on: { click: () => this.open() },
    },
    icon('plus'),
  );
  readonly #listId = `tag-choices-${++lists}`;
  readonly #field = h('input', {
    class: 'field tag-set__field',
    attrs: {
      type: 'text',
      role: 'combobox',
      'aria-label': 'Add a tag',
      'aria-autocomplete': 'list',
      'aria-expanded': 'false',
      'aria-controls': this.#listId,
      placeholder: '#tag',
      autocomplete: 'off',
      spellcheck: 'false',
      hidden: true,
    },
  });
  /** The field's menu: in the window's body, so no pane's edge clips it (the colophon's). */
  readonly #list = h('div', {
    class: 'menu tag-menu',
    attrs: { id: this.#listId, role: 'listbox', 'aria-label': 'Tags', hidden: true },
  });
  readonly #tags = h('span', { class: 'tag-set__tags' });
  #shown: NoteTags = { front: [], inline: [] };
  #choices: readonly TagChoice[] = [];
  #pick = 0;

  constructor(of: TagSetOf) {
    this.#of = of;
    this.element.append(this.#tags, this.#add, this.#field);
    this.#field.addEventListener('input', () => {
      this.#pick = 0;
      this.#offer();
    });
    this.#field.addEventListener('keydown', (event) => this.#key(event));
    // Away to another app isn't leaving the field: it waits.
    this.#field.addEventListener('blur', () => {
      if (document.hasFocus()) this.close(false);
    });
  }

  /** The note's tags; null with no note open. Drawn again only when they differ. */
  show(tags: NoteTags | null): void {
    this.element.hidden = tags === null;
    if (!tags) this.close(false);
    const next = tags ?? { front: [], inline: [] };
    if (same(next, this.#shown)) return;
    const had = document.activeElement;
    const key =
      had instanceof HTMLElement && this.#tags.contains(had) ? had.dataset.key : undefined;
    this.#shown = next;
    this.#tags.replaceChildren(
      ...next.front.map((tag) => this.#frontTag(tag)),
      ...next.inline.map((tag) => this.#textTag(tag)),
    );
    // A tag taken off with the keyboard: it goes to the next one's ×, or to the +.
    if (key && !had?.isConnected) {
      const again = this.#tags.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
      (again ?? this.#tags.querySelector<HTMLElement>('.tag__off') ?? this.#add).focus();
    }
    if (!this.#field.hidden) this.#offer();
  }

  /** The field, its menu open, the keyboard in it. */
  open(): void {
    if (this.element.hidden) return;
    this.#add.hidden = true;
    this.#field.hidden = false;
    this.#field.value = '';
    this.#pick = 0;
    this.#field.focus();
    this.#offer();
  }

  /** The field gone, the + back; `refocus` gives the + the keyboard. */
  close(refocus: boolean): void {
    this.#list.hidden = true;
    this.#list.remove();
    this.#field.setAttribute('aria-expanded', 'false');
    if (this.#field.hidden) return;
    this.#field.hidden = true;
    this.#add.hidden = false;
    if (refocus) this.#add.focus();
  }

  #frontTag(tag: string): HTMLElement {
    return h(
      'span',
      { class: 'tag' },
      `#${tag}`,
      h(
        'button',
        {
          class: 'tag__off',
          attrs: {
            type: 'button',
            'aria-label': `Take #${tag} off`,
            'data-tip': `Take #${tag} off`,
            'data-key': `page-tag:${tagKey(tag)}`,
          },
          on: { click: () => this.#of.remove(tag) },
        },
        icon('close'),
      ),
    );
  }

  #textTag(tag: string): HTMLElement {
    return h('button', {
      class: 'tag tag--text',
      text: `#${tag}`,
      attrs: {
        type: 'button',
        // Why there's no ×: the header never edits the words.
        'aria-label': `#${tag}, typed in the note: find it`,
        'data-tip': 'Typed in the note · click to find it',
        'data-key': `page-tag:${tagKey(tag)}`,
      },
      on: { click: () => this.#of.find(tag) },
    });
  }

  #offer(): void {
    const has = [...this.#shown.front, ...this.#shown.inline];
    this.#choices = this.#of.choices(this.#field.value, has);
    this.#pick = Math.min(this.#pick, Math.max(0, this.#choices.length - 1));
    this.#list.replaceChildren(
      ...this.#choices.map((choice, i) =>
        h(
          'div',
          {
            class: choice.made ? 'tag-menu__item tag-menu__item--made' : 'tag-menu__item',
            attrs: {
              id: `${this.#listId}-${i}`,
              role: 'option',
              'aria-selected': String(i === this.#pick),
            },
            on: {
              // The field keeps the keyboard while one is chosen with the pointer.
              mousedown: (event) => event.preventDefault(),
              click: () => this.#choose(i),
            },
          },
          choice.made ? `Make #${choice.tag}` : `#${choice.tag}`,
          h('span', { class: 'count', text: choice.made ? 'new tag' : String(choice.count) }),
        ),
      ),
    );
    const any = this.#choices.length > 0;
    this.#field.setAttribute('aria-expanded', String(any));
    if (any) this.#field.setAttribute('aria-activedescendant', `${this.#listId}-${this.#pick}`);
    else this.#field.removeAttribute('aria-activedescendant');
    this.#list.hidden = !any;
    if (!any) return;
    if (!this.#list.isConnected) document.body.append(this.#list);
    // Under the field, or over it where there's no room below (the colophon's).
    const at = this.#field.getBoundingClientRect();
    const box = this.#list.getBoundingClientRect();
    const below = at.bottom + 4 + box.height <= window.innerHeight;
    const left = Math.max(8, Math.min(at.left, window.innerWidth - box.width - 8));
    this.#list.style.setProperty('--menu-x', `${left}px`);
    this.#list.style.setProperty(
      '--menu-y',
      `${below ? at.bottom + 4 : at.top - 4 - box.height}px`,
    );
  }

  #choose(i: number): void {
    const choice = this.#choices[i];
    if (!choice) return;
    this.#field.value = '';
    this.#pick = 0;
    this.#of.add(choice.tag);
  }

  #key(event: KeyboardEvent): void {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (step) {
      const count = this.#choices.length;
      if (count) this.#pick = (this.#pick + step + count) % count;
      this.#offer();
    } else if (event.key === 'Enter') this.#choose(this.#pick);
    else if (event.key === 'Escape') this.close(true);
    else if (event.key === 'Backspace' && this.#field.value === '') {
      // An empty field's ⌫ takes the last tag off: front matter's, never the text's.
      const last = this.#shown.front.at(-1);
      if (last) this.#of.remove(last);
    } else return;
    event.preventDefault();
  }
}

const same = (a: NoteTags, b: NoteTags) =>
  a.front.join('\n') === b.front.join('\n') && a.inline.join('\n') === b.inline.join('\n');
