// An EPUB's page (#40), what the pane asks of any page (../page/page-leaf.ts):
// the note's own sheet, holding a chapter drawn from cleaned nodes
// (./chapter-view.ts), the book's folders and title above it, its × while
// the window is split, and in the colophon which chapter of how many. A
// book that won't open says why on the sheet. Find comes with Phase 5: until
// then it does nothing here, as a note's does where its text isn't shown.

import { h } from '../dom';
import { type LeafFoot, type PageFind, type PaneLeaf, pageLeaf } from '../page/page-leaf';
import { quietButton } from '../quiet-button';

export class EpubPage implements PaneLeaf {
  readonly element: HTMLElement;
  readonly head: PaneLeaf['head'];
  readonly folio: PaneLeaf['folio'];
  readonly runningCrumbs = h('p', { class: 'label running-crumbs' });
  readonly aside = h('div', { class: 'page__aside' });
  readonly under = h('div', { class: 'epub__under' });
  readonly foot: LeafFoot;
  readonly find: PageFind = { open: () => {}, next: () => {}, previous: () => {} };
  readonly tipped: readonly HTMLElement[];
  readonly #crumbs = h('p', { class: 'crumbs label' });
  readonly #notice = h('p', { class: 'notice', attrs: { role: 'status', hidden: true } });
  /** The chapter, drawn: the book's stylesheet (./epub.css) styles what's in it. */
  readonly chapter = h('div', { class: 'epub-chapter' });
  readonly #sheet: HTMLElement;
  readonly #empty = h('p', {
    class: 'page__empty',
    text: 'Choose a book on the shelf.',
    attrs: { tabindex: '-1' },
  });
  readonly #scroll: HTMLElement;
  readonly #figure = h('span', { class: 'colophon__chapter count' });
  #name = '';

  constructor(close: () => void) {
    const closer = quietButton({
      label: 'Close this page',
      icon: 'close',
      keys: 'Mod-w',
      class: 'sheet__close',
      run: close,
    });
    this.tipped = [closer];
    this.#sheet = h(
      'article',
      { class: 'sheet epub-sheet quiet-row' },
      closer,
      h('div', { class: 'sheet__head' }, this.#crumbs),
      this.#notice,
      this.chapter,
    );
    this.#scroll = h(
      'div',
      // A stop of its own: the keyboard scrolls the chapter (no editor in it takes the keyboard).
      { class: 'page__scroll', attrs: { tabindex: '0', role: 'region' } },
      this.#sheet,
      this.#empty,
    );
    ({ element: this.element, head: this.head, folio: this.folio } = pageLeaf(this.#scroll));
    this.element.classList.add('page__leaf--epub');
    this.foot = {
      lead: h('span'),
      figures: [this.#figure],
      trail: h('span'),
      said: h('span', { class: 'colophon__said', attrs: { role: 'status' } }),
    };
    this.nothing();
  }

  get name(): string {
    return this.#name;
  }

  /** A book on the page: its name (the pager's, the label's), the folders above it, its language. */
  show(name: string, crumbs: string, language: string): void {
    this.#name = name;
    this.#sheet.hidden = false;
    this.#empty.hidden = true;
    this.#sheet.setAttribute('aria-label', name);
    this.#scroll.setAttribute('aria-label', name);
    this.#crumbs.textContent = this.runningCrumbs.textContent = crumbs;
    if (language) this.chapter.lang = language;
    else this.chapter.removeAttribute('lang');
  }

  /** Another book on its way: its name and folders, and nothing of the last one's left meanwhile. */
  loading(name: string, crumbs: string): void {
    this.show(name, crumbs, '');
    this.notice(null);
    this.chapter.replaceChildren();
    this.#figure.textContent = '';
  }

  /** A chapter in place of the last, `at` (its place among the book's, as the colophon says it), at its top. */
  drawn(chapter: DocumentFragment, at: string): void {
    this.notice(null);
    this.chapter.replaceChildren(chapter);
    this.#figure.textContent = at;
    this.#scroll.scrollTop = 0;
  }

  /** Words on the sheet in the chapter's place (a book or a chapter that won't open), or none. */
  notice(words: string | null): void {
    this.#notice.hidden = words === null;
    this.#notice.textContent = words ?? '';
    if (words !== null) {
      this.chapter.replaceChildren();
      this.#figure.textContent = '';
    }
  }

  /** No book on the page. */
  nothing(): void {
    this.#name = '';
    this.#sheet.hidden = true;
    this.#empty.hidden = false;
    this.chapter.replaceChildren();
    this.#scroll.setAttribute('aria-label', 'No book open');
    this.runningCrumbs.textContent = '';
    this.#figure.textContent = '';
  }

  focus(): void {
    (this.#sheet.hidden ? this.#empty : this.#scroll).focus();
  }

  key(): void {}

  dispose(): void {
    for (const part of [this.element, this.aside, this.under, this.runningCrumbs]) part.remove();
  }
}
