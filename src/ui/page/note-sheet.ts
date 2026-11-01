// The sheet a note lies on (./page.ts): its crumbs (and again for a running
// head across the window), its title renamed in place, a quiet notice, the
// editor's frame with a seal compared in its place, and its × while the
// window is split; with no note, the line that says to choose one. The page
// wires the editor, words and tags round it.

import { h } from '../dom';
import { quietButton } from '../quiet-button';
import { PageTitle, type TitleEvents } from './page-title';

export interface SheetOf extends TitleEvents {
  /** Its ×, shown while the window is split. */
  close(): void;
}

/** The layout's slots for the note's tags that lie on the sheet (../chrome/layout-spec.ts, TagSlot). */
export interface SheetTagSlots {
  readonly runningHead: HTMLElement;
  readonly underTitle: HTMLElement;
}

export class NoteSheet {
  readonly #crumbs = h('p', { class: 'crumbs label' });
  /** The breadcrumb again, for a running head across the window (C's): the pane shows the active page's. */
  readonly runningCrumbs = h('p', { class: 'label running-crumbs' });
  /** The note's name, renamed in place (./page-title.ts). */
  readonly title: PageTitle;
  readonly #notice = h('p', { class: 'notice', attrs: { role: 'status', hidden: true } });
  /** Where the editor goes. */
  readonly editorHost = h('div', { class: 'editor-host' });
  /** The editor, with its table's controls laid over it (../editor/table.css). */
  readonly editorFrame = h('div', { class: 'page__editor' }, this.editorHost);
  /** In the editor's place while a seal is compared or shown (read only). */
  readonly #compareHost = h('div', { class: 'compare-host', attrs: { hidden: true } });
  /** Its × (with a tooltip, so the window watches it). */
  readonly closer: HTMLButtonElement;
  readonly element: HTMLElement;
  /** With no note open; it takes the keyboard when the page is given it. */
  readonly empty = h('p', {
    class: 'page__empty',
    text: 'Choose a note, or make a new one.',
    attrs: { tabindex: '-1' },
  });

  constructor(of: SheetOf, tags: SheetTagSlots) {
    this.title = new PageTitle(of);
    this.closer = quietButton({
      label: 'Close this page',
      icon: 'close',
      keys: 'Mod-w',
      class: 'sheet__close',
      run: () => of.close(),
    });
    this.element = h(
      'article',
      { class: 'sheet quiet-row' },
      this.closer,
      h('div', { class: 'sheet__head' }, this.#crumbs, tags.runningHead),
      this.title.element,
      this.title.field,
      tags.underTitle,
      this.#notice,
      this.editorFrame,
      this.#compareHost,
    );
  }

  /** Whether a note lies on it. */
  get hasNote(): boolean {
    return !this.element.hidden;
  }

  /** A note on it, named `title` at `crumbs`; `text`, its words (for whether it opens with its own heading). */
  show(crumbs: string, title: string, text: string): void {
    this.element.hidden = false;
    this.empty.hidden = true;
    this.#crumbs.textContent = this.runningCrumbs.textContent = crumbs;
    this.title.set(title, text);
  }

  /** No note on it: whether the keyboard was in it, for the page to give it somewhere. */
  nothing(): boolean {
    const had = this.element.contains(document.activeElement);
    this.element.hidden = true;
    this.empty.hidden = false;
    this.runningCrumbs.textContent = '';
    return had;
  }

  retitle(title: string, text: string, crumbs: string): void {
    this.title.set(title, text);
    this.#crumbs.textContent = this.runningCrumbs.textContent = crumbs;
  }

  /** A quiet line on the sheet, or none. */
  notice(text: string | null): void {
    this.#notice.hidden = text === null;
    this.#notice.textContent = text ?? '';
  }

  /** Show `view` (read only) in the editor's place; null gives the editor back. */
  compare(view: HTMLElement | null): void {
    this.#compareHost.replaceChildren(...(view ? [view] : []));
    this.#compareHost.hidden = view === null;
    this.editorHost.hidden = view !== null;
  }

  /** Whether a seal is shown in the editor's place. */
  get comparing(): boolean {
    return !this.#compareHost.hidden;
  }

  /** The keyboard to the seal compared, in the editor's place. */
  focusCompared(): void {
    this.#compareHost.querySelector<HTMLElement>('[tabindex]')?.focus();
  }
}
