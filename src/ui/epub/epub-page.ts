// An EPUB's page (#40), what the pane asks of any page (../page/page-leaf.ts):
// its frame, the note's own sheet with the book's folders above it and its ×
// while the window is split, holding a chapter (./chapter-sheet.ts: drawn,
// its place kept, its links and words); its colophon (./book-foot.ts); the
// shelf's look worn on its leaf, the scroll style among it; and its keys, Q
// to quote and ⌘[ or Alt+← back. A book that won't open says why on the
// sheet. Find comes with Phase 5: until then it does nothing here, as a
// note's does where its text isn't shown.

import type { SettingValues } from '../../core/config';
import { h } from '../dom';
import { type PageFind, type PaneLeaf, pageLeaf } from '../page/page-leaf';
import { quietButton } from '../quiet-button';
import { leafLook } from '../settings/look-properties';
import { BookFoot } from './book-foot';
import { ChapterSheet, type ChapterSheetOf } from './chapter-sheet';

/** Where a key is the writer's own: a note's editor, a field. */
const FIELD = '.editor-host, input, textarea, [contenteditable]';

export interface EpubPageOf extends Omit<ChapterSheetOf, 'scroller'> {
  /** Close this page (its ×, ⌘W). */
  close(): void;
  /** Back where the last link was followed from. */
  back(): void;
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
  readonly #sheet: HTMLElement;
  readonly #empty = h('p', {
    class: 'page__empty',
    text: 'Choose a book on the shelf.',
    attrs: { tabindex: '-1' },
  });
  readonly #scroll: HTMLElement;
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
    // The chapter's links too, each named for the tooltip (./book-links.ts nameLinks).
    this.tipped = [closer, this.chapter];
    this.#sheet = h(
      'article',
      { class: 'sheet epub-sheet quiet-row' },
      closer,
      h('div', { class: 'sheet__head' }, this.#crumbs),
      this.#notice,
      this.chapter,
      this.sheet.turns,
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

  /** The book's title; with none open, says so (the pager's name, a folded split's edge). */
  get name(): string {
    return this.#name || 'No book';
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
    this.sheet.keep();
    for (const [name, value] of Object.entries(wanted)) leaf.dataset[name] = value;
    for (const [name, value] of Object.entries(properties)) leaf.style.setProperty(name, value);
    this.sheet.reshow();
  }

  /** Q quotes; ⌘[ or Alt+←, as a browser goes back: back where the last link was followed from. */
  key(event: KeyboardEvent): void {
    // Not from a field (the page beside's words, its tags): Alt+← is a word left there.
    if (event.target instanceof Element && event.target.closest(FIELD)) return;
    const plain = !event.metaKey && !event.ctrlKey && !event.altKey;
    // Q, with words chosen in the chapter: quoted in the note beside (Phase 2c).
    if (plain && event.key.toLowerCase() === 'q' && this.sheet.selection) {
      event.preventDefault();
      this.#of.quote();
      return;
    }
    const back =
      (event.key === '[' && (event.metaKey || event.ctrlKey) && !event.altKey) ||
      (event.key === 'ArrowLeft' && event.altKey && !event.metaKey && !event.ctrlKey);
    if (!back || !this.foot.canGoBack) return;
    event.preventDefault();
    this.#of.back();
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
