// An EPUB's page (#40), what the pane asks of any page (../page/page-leaf.ts):
// the note's own sheet, holding a chapter drawn from cleaned nodes
// (./chapter-view.ts) with the chapters either side at its foot
// (./chapter-foot.ts), the book's folders and title above it, its × while
// the window is split, and in the colophon which chapter of how many and how
// far through it and the book. It scrolls a chapter at a time, its place
// kept (./place-keeper.ts), its paragraphs as the scroll style sets them
// (Phase 2). A book that won't open says why on the sheet. Find comes with
// Phase 5: until then it does nothing here, as a note's does where its text
// isn't shown.

import type { SettingValues } from '../../core/config';
import { percent } from '../../core/epub';
import { h } from '../dom';
import { type LeafFoot, type PageFind, type PaneLeaf, pageLeaf } from '../page/page-leaf';
import { quietButton } from '../quiet-button';
import { leafLook } from '../settings/look-properties';
import { PlaceKeeper } from './place-keeper';

export interface EpubPageOf {
  /** Close this page (its ×, ⌘W). */
  close(): void;
  /** As it scrolls: how far through the chapter (0 to 1). */
  moved(fraction: number): void;
  /** Its place came to rest somewhere new: an offset in the chapter's words. */
  rested(offset: number): void;
}

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
  readonly #turns = h('div', { class: 'epub__turns' });
  readonly #figure = h('span', { class: 'colophon__chapter count' });
  readonly #inChapter = h('span', { class: 'colophon__through count' });
  readonly #inBook = h('span', { class: 'colophon__through count' });
  readonly #keeper: PlaceKeeper;
  #name = '';
  /** The page's zoom last worn; null before the first. */
  #zoom: number | null = null;

  constructor(of: EpubPageOf) {
    const closer = quietButton({
      label: 'Close this page',
      icon: 'close',
      keys: 'Mod-w',
      class: 'sheet__close',
      run: () => of.close(),
    });
    this.tipped = [closer];
    this.#sheet = h(
      'article',
      { class: 'sheet epub-sheet quiet-row' },
      closer,
      h('div', { class: 'sheet__head' }, this.#crumbs),
      this.#notice,
      this.chapter,
      this.#turns,
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
    this.#keeper = new PlaceKeeper({
      scroller: this.#scroll,
      chapter: this.chapter,
      moved: (fraction) => of.moved(fraction),
      rested: (offset) => of.rested(offset),
    });
    this.foot = {
      lead: h('span'),
      figures: [this.#figure, this.#inChapter, this.#inBook],
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
    this.#clearChapter();
  }

  /**
   * A chapter in place of the last, with its foot, `at` (its place among the
   * book's, as the colophon says it), its place `offset` kept and shown (again
   * by `showPlace` once its pictures are laid out).
   */
  drawn(chapter: DocumentFragment, foot: HTMLElement, at: string, offset: number): void {
    this.notice(null);
    this.chapter.replaceChildren(chapter);
    this.#turns.replaceChildren(foot);
    this.#figure.textContent = at;
    this.#keeper.show(offset);
  }

  /** The place kept in the chapter: an offset in its words, as last measured at rest. */
  get place(): number {
    return this.#keeper.offset;
  }

  /** The chapter shown with the line holding `offset` at its top, and that kept as its place. */
  showPlace(offset: number): void {
    this.#keeper.show(offset);
  }

  /** A place on its way to rest, kept now (the page closing, the window quitting). */
  keepPlace(): void {
    this.#keeper.keep();
  }

  /** How far through the chapter and the book, 0 to 1 each, as the colophon says it. */
  through(chapter: number, book: number): void {
    this.#inChapter.textContent = `${percent(chapter)} of the chapter`;
    this.#inBook.textContent = `${percent(book)} of the book`;
  }

  /** About to be taken out and put back (../page/page-leaf.ts): a rest on its way kept while it's laid out. */
  taking(): void {
    this.#keeper.keep();
  }

  /** Put back: its scroll began again at the top, so its place is shown again. */
  placed(): void {
    this.#keeper.reshow();
  }

  /** Words on the sheet in the chapter's place (a book or a chapter that won't open), or none. */
  notice(words: string | null): void {
    this.#notice.hidden = words === null;
    this.#notice.textContent = words ?? '';
    if (words !== null) this.#clearChapter();
  }

  /** No chapter on the sheet, and nothing said of one. */
  #clearChapter(): void {
    this.#keeper.clear();
    this.chapter.replaceChildren();
    this.#turns.replaceChildren();
    for (const figure of [this.#figure, this.#inChapter, this.#inBook]) figure.textContent = '';
  }

  /** No book on the page. */
  nothing(): void {
    this.#name = '';
    this.#sheet.hidden = true;
    this.#empty.hidden = false;
    this.#clearChapter();
    this.#scroll.setAttribute('aria-label', 'No book open');
    this.runningCrumbs.textContent = '';
  }

  focus(): void {
    (this.#sheet.hidden ? this.#empty : this.#scroll).focus();
  }

  /** The shelf's look (#40, Phase 1c), worn on this page alone: a note's look never changes it. */
  wear(values: SettingValues): void {
    this.#zoomed(values['page.zoom']);
    const { face, frame, properties } = leafLook(values);
    const leaf = this.element;
    // The scroll style (Phase 2): a note's paragraphs, or a book's (./epub.css).
    const wanted = { face, frame, scroll: values['epub.scroll'] };
    // Only what changed: setting an attribute again restyles the page (as ../settings/look.ts says).
    const changed =
      Object.entries(wanted).filter(([name, value]) => leaf.dataset[name] !== value).length +
      Object.entries(properties).filter(
        ([name, value]) => leaf.style.getPropertyValue(name) !== value,
      ).length;
    if (changed === 0) return;
    // The lines move: the place is kept as it stood, and shown again in the new look.
    this.#keeper.keep();
    for (const [name, value] of Object.entries(wanted)) leaf.dataset[name] = value;
    for (const [name, value] of Object.entries(properties)) leaf.style.setProperty(name, value);
    this.#keeper.reshow();
  }

  key(): void {}

  /**
   * The page's zoom, which the window sets on the sheet: the lines move, but
   * not the chapter's own box, so no resize tells. The line is shown again
   * once the new zoom is drawn.
   */
  #zoomed(zoom: number): void {
    const was = this.#zoom;
    this.#zoom = zoom;
    if (was === null || was === zoom) return;
    requestAnimationFrame(() => this.#keeper.reshow());
  }

  dispose(): void {
    this.#keeper.dispose();
    for (const part of [this.element, this.aside, this.under, this.runningCrumbs]) part.remove();
  }
}
