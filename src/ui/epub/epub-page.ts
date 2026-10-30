// An EPUB's page (#40), what the pane asks of any page (../page/page-leaf.ts):
// its frame, the note's own sheet with the book's folders above it and its ×
// while the window is split, holding a chapter (./chapter-sheet.ts: drawn,
// its place kept, its links and words); its colophon (./book-foot.ts); the
// shelf's look worn on its leaf, the scroll style among it; its bookmark's
// mark (Phase 4b, the Page mark's look); and its keys, Q to quote, B to
// bookmark, and ⌘[ or Alt+← back. A book that won't open says why on the
// sheet. Find comes with Phase 5: until then it does nothing here, as a
// note's does where its text isn't shown.

import type { SettingValues } from '../../core/config';
import { h } from '../dom';
import { type PageFind, type PaneLeaf, pageLeaf } from '../page/page-leaf';
import { pageMark } from '../page/page-mark';
import { quietButton } from '../quiet-button';
import { leafLook } from '../settings/look-properties';
import { BookFoot } from './book-foot';
import { ChapterSheet, type ChapterSheetOf } from './chapter-sheet';
import { LeafEdges } from './leaf-edges';
import { pageKey, pageTap } from './page-keys';
import { STAYS } from './turn/page-copy';

/** Where a key is the writer's own: a note's editor, a field. */
const FIELD = '.editor-host, input, textarea, [contenteditable]';

export interface EpubPageOf extends Omit<ChapterSheetOf, 'scroller'> {
  /** Close this page (its ×, ⌘W). */
  close(): void;
  /** In pages (Phase 3b): a page turned `way`, by a key (`held`, repeating) or the edges. */
  turn(way: 1 | -1, held: boolean): void;
  /** In pages: the chapter's first page (Home) or its last (End). */
  edge(last: boolean): void;
  /** Back where the last link was followed from. */
  back(): void;
  /** B: the page in sight bookmarked, or its bookmark taken off (Phase 4b). */
  bookmark(): void;
}

export class EpubPage implements PaneLeaf {
  readonly element: HTMLElement;
  readonly head: PaneLeaf['head'];
  readonly folio: PaneLeaf['folio'];
  readonly runningCrumbs = h('p', { class: 'label running-crumbs' });
  readonly aside = h('div', { class: 'page__aside' });
  readonly under = h('div', { class: 'epub__under' });
  readonly foot: BookFoot;
  readonly find: PageFind = { open: () => {}, next: () => {}, previous: () => {} };
  readonly tipped: readonly HTMLElement[];
  readonly #crumbs = h('p', { class: 'crumbs label' });
  readonly #notice = h('p', { class: 'notice', attrs: { role: 'status', hidden: true } });
  /** The chapter on the sheet: drawn, its place, its links and words. */
  readonly sheet: ChapterSheet;
  /** In pages, the book's fore-edge either side of the sheet: how far through, and where to turn. */
  readonly edges: LeafEdges;
  readonly #sheet: HTMLElement;
  readonly #empty = h('p', {
    class: 'page__empty',
    text: 'Choose a book on the shelf.',
    attrs: { tabindex: '-1' },
  });
  readonly #scroll: HTMLElement;
  /** A bookmarked page's mark, at the sheet's outer top; it stays as a page turns (a turn's copies leave it out). */
  readonly #mark = pageMark('bookmark', 'right');
  #name = '';
  /** The page's zoom last worn; null before the first. */
  #zoom: number | null = null;

  readonly #of: EpubPageOf;

  constructor(of: EpubPageOf) {
    this.#of = of;
    const closer = quietButton({
      label: 'Close this page',
      icon: 'close',
      keys: 'Mod-w',
      class: 'sheet__close',
      run: () => of.close(),
    });
    this.#scroll = h(
      'div',
      // A stop of its own: the keyboard scrolls the chapter (no editor in it takes the keyboard).
      { class: 'page__scroll', attrs: { tabindex: '0', role: 'region' } },
    );
    this.sheet = new ChapterSheet({ ...of, scroller: this.#scroll });
    this.edges = new LeafEdges((way) => of.turn(way, false));
    // The pointer a click came from, by its pointerdown: WebKit's click may not say.
    let pointer = '';
    this.sheet.box.addEventListener('pointerdown', (event) => {
      pointer = event.pointerType;
    });
    this.sheet.box.addEventListener('click', (event) => {
      if (this.sheet.paged) pageTap(event, pointer, this.sheet.box, of);
    });
    // The chapter's links too, each named for the tooltip (./book-links.ts nameLinks).
    this.tipped = [closer, this.chapter, ...this.edges.turns];
    this.#mark.hidden = true;
    this.#sheet = h(
      'article',
      { class: 'sheet epub-sheet quiet-row' },
      // The mark's holder keeps to the top of the sheet in sight as a chapter scrolls (./bookmark.css).
      h('span', { class: 'epub-sheet__mark', attrs: { [STAYS]: '' } }, this.#mark),
      closer,
      h('div', { class: 'sheet__head' }, this.#crumbs),
      this.#notice,
      this.sheet.box,
      this.sheet.turns,
      this.edges.element,
    );
    this.#scroll.append(this.#sheet, this.#empty);
    ({ element: this.element, head: this.head, folio: this.folio } = pageLeaf(this.#scroll));
    this.element.classList.add('page__leaf--epub');
    this.foot = new BookFoot(() => of.back());
    this.nothing();
  }

  /** The chapter's words, drawn. */
  get chapter(): HTMLElement {
    return this.sheet.element;
  }

  readonly unnamed = 'No book';

  /** The book's title; '' with none open (the window then takes its vault's name). */
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
   * by the sheet's `showPlace` once its pictures are laid out).
   */
  drawn(chapter: DocumentFragment, foot: HTMLElement, at: string, offset: number): void {
    this.notice(null);
    this.sheet.drawn(chapter, foot, offset);
    this.foot.at(at);
  }

  /** The sheet, in sight: what a page turn turns (./turn/page-turn.ts). */
  get leaf(): HTMLElement {
    return this.#sheet;
  }

  /** The page's scroller: what a note over it closes with. */
  get scroller(): HTMLElement {
    return this.#scroll;
  }

  /** About to be taken out and put back (../page/page-leaf.ts): a rest on its way kept while it's laid out. */
  taking(): void {
    this.sheet.keep();
  }

  /** Put back: its scroll began again at the top, so its place is shown again. */
  placed(): void {
    this.sheet.reshow();
  }

  /** The page in sight bookmarked or not: its mark, arriving anew on each page that has one, and the folio's word. */
  bookmarked(on: boolean): void {
    if (this.#mark.hidden === !on) return;
    this.#mark.hidden = !on;
    this.foot.bookmarked(on);
  }

  /** Words on the sheet in the chapter's place (a book or a chapter that won't open), or none. */
  notice(words: string | null): void {
    this.#notice.hidden = words === null;
    this.#notice.textContent = words ?? '';
    if (words !== null) this.#clearChapter();
  }

  /** No chapter on the sheet, and nothing said of one. */
  #clearChapter(): void {
    this.sheet.clear();
    this.foot.clear();
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
    // The scroll style (Phase 2): a note's paragraphs, or a book's (./epub.css); in pages, a book's.
    const wanted = {
      face,
      frame,
      scroll: values['epub.scroll'],
      view: values['epub.view'],
      marks: values['epub.marks'],
    };
    // Only what changed: setting an attribute again restyles the page (as ../settings/look.ts says).
    const changed =
      Object.entries(wanted).filter(([name, value]) => leaf.dataset[name] !== value).length +
      Object.entries(properties).filter(
        ([name, value]) => leaf.style.getPropertyValue(name) !== value,
      ).length;
    if (changed === 0) return;
    // The lines move: the place is kept as it stood, and shown again in the new look.
    this.sheet.keep();
    for (const [name, value] of Object.entries(wanted)) leaf.dataset[name] = value;
    for (const [name, value] of Object.entries(properties)) leaf.style.setProperty(name, value);
    this.sheet.paged = wanted.view === 'pages';
    this.sheet.reshow();
  }

  /** Q quotes; ⌘[ or Alt+←, as a browser goes back: back where the last link was followed from. */
  key(event: KeyboardEvent): void {
    // Not from a field (the page beside's words, its tags): Alt+← is a word left there.
    if (event.target instanceof Element && event.target.closest(FIELD)) return;
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
    // Q, with words chosen in the chapter now: quoted in the note beside (Phase 2c); held, once.
    if (plain && event.key.toLowerCase() === 'q' && this.sheet.selection) {
      event.preventDefault();
      if (!event.repeat) this.#of.quote();
      return;
    }
    // B bookmarks the page in sight, or takes its bookmark off (Phase 4b); held, once.
    if (plain && event.key.toLowerCase() === 'b' && !this.#sheet.hidden) {
      event.preventDefault();
      if (!event.repeat) this.#of.bookmark();
      return;
    }
    const back =
      (event.key === '[' && (event.metaKey || event.ctrlKey) && !event.altKey) ||
      (event.key === 'ArrowLeft' && event.altKey && !event.metaKey && !event.ctrlKey);
    if (back) {
      if (!this.foot.canGoBack) return;
      event.preventDefault();
      this.#of.back();
      return;
    }
    if (plain && this.sheet.paged) pageKey(event, this.#of);
  }

  /**
   * The page's zoom, which the window sets on the sheet: the lines move, but
   * not the chapter's own box, so no resize tells. The line is shown again
   * once the new zoom is drawn.
   */
  #zoomed(zoom: number): void {
    const was = this.#zoom;
    this.#zoom = zoom;
    if (was === null || was === zoom) return;
    requestAnimationFrame(() => this.sheet.reshow());
  }

  dispose(): void {
    this.sheet.dispose();
    this.foot.stop();
    for (const part of [this.element, this.aside, this.under, this.runningCrumbs]) part.remove();
  }
}
