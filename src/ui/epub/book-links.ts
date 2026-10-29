// A book's own links on its page (#40, Phase 2b): every click on an address
// of the page's own ("#…") is caught before the window could follow it, and
// a book's link (core/epub/book-link.ts) is handed on: to a note shown over
// the page when it names one, else to its chapter and place. And the places
// a link may name are found by their markers, never by a selector built from
// the book's words.

import { bookLinkOf, type ZipAddress } from '../../core/epub';

/** Clicks on `root`'s links caught: a book's own link told to `follow`; any other "#" address only stopped. */
export function catchLinks(
  root: HTMLElement,
  follow: (anchor: HTMLAnchorElement, link: ZipAddress) => void,
): void {
  root.addEventListener(
    'click',
    (event) => {
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || !root.contains(anchor)) return;
      const href = anchor.getAttribute('href') ?? '';
      if (!href.startsWith('#')) return;
      // Never the window's: a hash would scroll it to an element of its own of that name.
      event.preventDefault();
      const link = bookLinkOf(href);
      if (link) follow(anchor, link);
    },
    true,
  );
}

/** A note's mark as EPUB 2 books write one: a number or a sign, perhaps in brackets, set as a superscript. */
const MARK = /^[[(]?[\d*†‡§]{1,3}[\])]?$/u;

/** Whether `anchor` refers to a note: named so, or a mark in a sup; never a link inside a note. */
export function isNoteRef(anchor: HTMLAnchorElement, link: ZipAddress): boolean {
  if (link.fragment === '' || anchor.closest('[data-part="note"]')) return false;
  if (anchor.dataset.part === 'note-ref') return true;
  const superscript = anchor.closest('sup') !== null || anchor.querySelector('sup') !== null;
  return superscript && MARK.test(anchor.textContent?.trim() ?? '');
}

/** The marker of the place `name` in `root`, the first of that name. */
export function markerIn(root: ParentNode, name: string): HTMLElement | null {
  for (const marker of root.querySelectorAll<HTMLElement>('a[data-anchor]')) {
    if (marker.dataset.anchor === name) return marker;
  }
  return null;
}

/** The blocks a note may be. */
const BLOCKS = 'p, div, li, dd, dt, blockquote, td, th, figure, h1, h2, h3, h4, h5, h6';

/** A block of words: one holding no other block. */
const isLeafBlock = (element: Element): element is HTMLElement =>
  element.matches(BLOCKS) && !element.querySelector(BLOCKS);

/**
 * The note the place `name` heads in `root`: a note the book names, else the
 * block of words its marker is in, else (a marker standing before its note,
 * as conversions leave them) the next block of words after it. Never `root`
 * itself, nor a block that holds others (a chapter's wrapper): one note.
 */
export function noteIn(root: Node, name: string): HTMLElement | null {
  const marker = markerIn(root as ParentNode, name);
  if (!marker) return null;
  const inRoot = (element: Element | null): element is HTMLElement =>
    element !== null && element !== root && root.contains(element);
  const named = marker.closest('[data-part="note"]');
  if (inRoot(named)) return named;
  const block = marker.parentElement?.closest(BLOCKS) ?? null;
  if (inRoot(block) && isLeafBlock(block)) return block;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  walker.currentNode = marker;
  for (let next = walker.nextNode(); next; next = walker.nextNode()) {
    if (next instanceof Element && isLeafBlock(next)) return next as HTMLElement;
  }
  return null;
}
