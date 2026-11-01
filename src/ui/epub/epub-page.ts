// An EPUB's page (#40), what the pane asks of any page (../page/page-leaf.ts):
// its frame, the note's own sheet with the book's folders above it and its ×
// while the window is split, holding a chapter (./chapter-sheet.ts: drawn,
// its place kept, its links and words); its colophon (./book-foot.ts); the
// shelf's look worn on its leaf, the scroll style among it; its bookmark's
// mark (Phase 4b, the Page mark's look), on each page of a spread (Phase
// 3d); in pages, its running heads and folios; and its keys, Q to quote, B to
// bookmark, and ⌘[ or Alt+← back. A book that won't open says why on the
// sheet. Find comes with Phase 5: until then it does nothing here, as a
// note's does where its text isn't shown.

import type { SettingValues } from '../../core/config';
import { h } from '../dom';
import { type PageFind, type PaneLeaf, pageLeaf } from '../page/page-leaf';
import { quietButton } from '../quiet-button';
import { leafLook } from '../settings/look-properties';
import { BookFoot } from './book-foot';
import { ChapterSheet, type ChapterSheetOf } from './chapter-sheet';
import { hyphenates } from './hyphens';
import { LeafEdges } from './leaf-edges';
import { type BookKeysOf, bookKey, pageTap } from './page-keys';
import { PageMarks } from './page-marks';
import { RunningHeads } from './running-heads';
import { type PagesChoices, pagesChoices, pagesNow } from './spread';

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
  /** H: the words chosen highlighted, or the highlight they lie in taken off (Phase 5a). */
  highlight(): void;
  /** `]` or `[`: to the next mark, or the one before (Phase 5b). */
  walk(way: 1 | -1): void;
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
  /** In pages, what's over and under the text: the running heads and folios (Phase 3d). */
  readonly heads = new RunningHeads();
  readonly #sheet: HTMLElement;
  readonly #empty = h('p', {
    class: 'page__empty',
    text: 'Choose a book on the shelf.',
    attrs: { tabindex: '-1' },
  });
  readonly #scroll: HTMLElement;
  /** A bookmarked page's mark, at its outer top. */
  readonly #marks = new PageMarks();
  #name = '';
  /** The page's zoom last worn; null before the first. */
  #zoom: number | null = null;
  /** One page or two for the screen held wide and held tall, as last worn. */
  #pages: PagesChoices = { landscape: 'auto', portrait: 'auto' };

  /** What its keys do (./page-keys.ts). */
  readonly #keys: BookKeysOf;

  constructor(of: EpubPageOf) {
    this.#keys = {
      turn: (way, held) => of.turn(way, held),
      edge: (last) => of.edge(last),
      quote: () => of.quote(),
      bookmark: () => of.bookmark(),
      highlight: () => of.highlight(),
      walk: (way) => of.walk(way),
      back: () => of.back(),
      chosen: () => this.sheet.selection !== null,
      shown: () => !this.#sheet.hidden,
      paged: () => this.sheet.paged,
      canGoBack: () => this.foot.canGoBack,
    };
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
    this.sheet = new ChapterSheet({
      ...of,
      scroller: this.#scroll,
      pages: () => pagesNow(this.#pages),
    });
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
    this.#sheet = h(
      'article',
      { class: 'sheet epub-sheet quiet-row' },
      this.#marks.element,
      closer,
      h('div', { class: 'sheet__head' }, this.#crumbs),
      this.heads.head,
      this.#notice,
      this.sheet.box,
      this.heads.folio,
      this.sheet.turns,
      this.edges.element,
    );
    this.#scroll.append(this.#sheet, this.#empty);
    ({ element: this.element, head: this.head, folio: this.folio } = pageLeaf(this.#scroll));
    this.element.classList.add('page__leaf--epub');
    this.foot = new BookFoot(
      () => of.back(),
      () => this.focus(),
    );
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
    // Set as a book justifies only where its words can break at a hyphen (./hyphens.ts).
    this.element.toggleAttribute('data-hyphens', hyphenates(language));
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

  /**
   * The pages in sight bookmarked or not, a spread's verso (`left`) and its recto or one page
   * (`right`): each mark, arriving anew on each page that has one, and the folio's word.
   */
  bookmarked(left: boolean, right: boolean): void {
    // The folio's word every time: the foot may have been cleared.
    this.foot.bookmarked(left || right);
    this.#marks.show(left, right);
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
    const pages = pagesChoices(values);
    const changed =
      Object.entries(wanted).filter(([name, value]) => leaf.dataset[name] !== value).length +
      Object.entries(properties).filter(
        ([name, value]) => leaf.style.getPropertyValue(name) !== value,
      ).length +
      Number(pages.landscape !== this.#pages.landscape || pages.portrait !== this.#pages.portrait);
    if (changed === 0) return;
    this.#pages = pages;
    // The lines move: the place is kept as it stood, and shown again in the new look.
    this.sheet.keep();
    for (const [name, value] of Object.entries(wanted)) leaf.dataset[name] = value;
    for (const [name, value] of Object.entries(properties)) leaf.style.setProperty(name, value);
    this.sheet.paged = wanted.view === 'pages';
    this.sheet.reshow();
  }

  /** A key on the page (./page-keys.ts): Q, B, Back, and in pages its turns. */
  key(event: KeyboardEvent): void {
    bookKey(event, this.#keys);
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
