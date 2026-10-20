// The versions panel (spec §9, docs/design): raised paper beside the page,
// the draft first, then each seal, newest first — its name, when it was
// sealed and its words — with Compare, Restore, Name and Delete. A seal is
// named in place: Enter keeps the name, Esc doesn't.

import type { VersionFile } from '../../core/versions';
import { h, wordButton } from '../dom';

export interface PanelSeal {
  readonly version: VersionFile;
  /** "Sealed 2h ago". */
  readonly when: string;
  /** Its words; null while they're counted. */
  readonly words: number | null;
}

export interface PanelModel {
  readonly draftWords: number;
  readonly seals: readonly PanelSeal[];
  /** The seal compared with the draft, if one is. */
  readonly compared: string | null;
  /** The keys that seal, as this system writes them. */
  readonly sealKeys: string;
}

export interface PanelActions {
  close(): void;
  compare(version: VersionFile): void;
  restore(version: VersionFile): void;
  name(version: VersionFile, typed: string): void;
  remove(version: VersionFile): void;
}

export class VersionsPanel {
  readonly element: HTMLElement;
  readonly #list = h('ol', { class: 'versions__list' });
  readonly #actions: PanelActions;
  #model: PanelModel | null = null;
  /** The seal being named, and what's typed so far: kept across redraws. */
  #naming: { file: string; typed: string; start: number; end: number } | null = null;
  /** Set while the rows are replaced: a field taken out by it isn't the writer leaving it. */
  #drawing = false;

  constructor(actions: PanelActions) {
    this.#actions = actions;
    this.element = h(
      'aside',
      { class: 'versions', attrs: { 'aria-label': 'Versions', hidden: true } },
      h(
        'div',
        { class: 'versions__head' },
        h('span', { class: 'label', text: 'Versions' }),
        wordButton('Close', actions.close, { 'data-key': 'close' }),
      ),
      this.#list,
      h('p', {
        class: 'versions__note',
        text: 'Restoring seals the draft first, so nothing is lost. Named seals are kept until you delete them; other seals older than 30 days are thinned to one a day.',
      }),
    );
  }

  get open(): boolean {
    return !this.element.hidden;
  }

  show(open: boolean): void {
    this.element.hidden = !open;
  }

  /** Give the keyboard to the panel: its first seal's Compare, or Close. */
  focus(): void {
    (
      this.#list.querySelector<HTMLElement>('[data-key^="compare:"]') ??
      this.element.querySelector<HTMLElement>('[data-key="close"]')
    )?.focus();
  }

  draw(model: PanelModel): void {
    this.#model = model;
    const active = document.activeElement;
    // A redraw keeps the keyboard where it was: on the same control of the same seal, or,
    // that seal gone (deleted), on the same control of the seal now in its place.
    const inPanel = active instanceof HTMLElement && this.element.contains(active);
    const focused = inPanel ? active.dataset.key : undefined;
    const rowsBefore = [...this.#list.children];
    const focusedRow = inPanel ? rowsBefore.findIndex((row) => row.contains(active)) : -1;
    const draft = h(
      'li',
      { class: 'version' },
      h('span', { class: 'version__mark version__mark--draft', attrs: { 'aria-hidden': 'true' } }),
      h('span', { class: 'version__when', text: 'Draft · now' }),
      h('span', { class: 'count', text: `${model.draftWords.toLocaleString()} w` }),
    );
    this.#drawing = true;
    this.#list.replaceChildren(
      draft,
      ...model.seals.map((seal) => this.#row(seal, model)),
      ...(model.seals.length === 0
        ? [
            h('li', {
              class: 'versions__empty',
              text: `Not sealed yet. ${model.sealKeys} seals the draft.`,
            }),
          ]
        : []),
    );
    this.#drawing = false;
    // A name being typed carries on in the new field: its words, and the caret where it was.
    const field = this.#list.querySelector<HTMLInputElement>('.version__field');
    if (field && this.#naming) {
      field.focus();
      field.setSelectionRange(this.#naming.start, this.#naming.end);
      return;
    }
    if (!focused) return;
    const same = [...this.element.querySelectorAll<HTMLElement>('[data-key]')].find(
      (control) => control.dataset.key === focused,
    );
    if (same) {
      same.focus();
      return;
    }
    const action = focused.slice(0, focused.indexOf(':'));
    const rows = [...this.#list.children];
    const row = rows[Math.min(focusedRow, rows.length - 1)];
    (
      row?.querySelector<HTMLElement>(`[data-key^="${action}:"]`) ??
      row?.querySelector<HTMLElement>('[data-key]') ??
      this.element.querySelector<HTMLElement>('[data-key="close"]')
    )?.focus();
  }

  #row(seal: PanelSeal, model: PanelModel): HTMLElement {
    const { version } = seal;
    const called = version.name ? `“${version.name}”` : `the seal ${seal.when.toLowerCase()}`;
    // Keyed by when it was sealed, which naming it doesn't change: the keyboard stays on it.
    const key = (action: string) => `${action}:${version.at}~${version.count}`;
    const naming = this.#naming?.file === version.file ? this.#naming : null;
    return h(
      'li',
      { class: version.file === model.compared ? 'version is-compared' : 'version' },
      h('span', { class: 'version__mark seal seal--small', attrs: { 'aria-hidden': 'true' } }),
      naming ? this.#field(version, naming.typed) : null,
      !naming && version.name ? h('span', { class: 'version__name', text: version.name }) : null,
      h('span', { class: 'version__when', text: seal.when }),
      h('span', {
        class: 'count',
        text: seal.words === null ? '' : `${seal.words.toLocaleString()} w`,
      }),
      h(
        'div',
        { class: 'version__actions' },
        wordButton('Compare', () => this.#actions.compare(version), {
          'aria-pressed': String(version.file === model.compared),
          'aria-label': `Compare the draft with ${called}`,
          'data-key': key('compare'),
        }),
        wordButton('Restore', () => this.#actions.restore(version), {
          'aria-label': `Restore ${called}`,
          'data-key': key('restore'),
        }),
        wordButton('Name', () => this.#startNaming(version), {
          'aria-label': version.name ? `Rename ${called}` : `Name ${called}`,
          'data-key': key('name'),
        }),
        wordButton('Delete', () => this.#actions.remove(version), {
          class: 'word-button version__delete',
          'aria-label': `Send ${called} to the trash`,
          'data-key': key('delete'),
        }),
      ),
    );
  }

  #startNaming(version: VersionFile): void {
    const typed = version.name ?? '';
    this.#naming = { file: version.file, typed, start: 0, end: typed.length };
    if (this.#model) this.draw(this.#model);
  }

  /** The seal's name as a field: Enter, or leaving the field, keeps it; Esc doesn't. */
  #field(version: VersionFile, typed: string): HTMLElement {
    const field = h('input', {
      class: 'field version__field',
      attrs: {
        type: 'text',
        'aria-label': 'Name this seal',
        spellcheck: 'false',
        placeholder: 'Name',
      },
    });
    field.value = typed;
    const finish = (keep: boolean) => {
      if (this.#naming?.file !== version.file) return;
      this.#naming = null;
      if (keep && field.value.trim() !== (version.name ?? ''))
        this.#actions.name(version, field.value);
      else if (this.#model) this.draw(this.#model);
      this.element
        .querySelector<HTMLElement>(`[data-key="name:${version.at}~${version.count}"]`)
        ?.focus();
    };
    const keep = () => {
      if (!this.#naming) return;
      this.#naming.typed = field.value;
      this.#naming.start = field.selectionStart ?? field.value.length;
      this.#naming.end = field.selectionEnd ?? field.value.length;
    };
    field.addEventListener('input', keep);
    field.addEventListener('select', keep);
    field.addEventListener('keyup', keep);
    field.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') finish(true);
      else if (event.key === 'Escape') finish(false);
      else return;
      event.preventDefault();
      event.stopPropagation();
    });
    field.addEventListener('blur', () => {
      if (!this.#drawing && field.isConnected && document.hasFocus()) finish(true);
    });
    return field;
  }
}
