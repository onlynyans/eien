// The words of a selection in a book (#40, Phase 2b), as they go anywhere
// else: copied, or quoted into a note (Phase 2c). What the page drew for the
// book's sake stays behind: a link keeps its words without its address (an
// address of this page's own means nothing elsewhere), a note's reference
// goes, as do a place's marker, a picture (the window's own copy) and every
// attribute. Its shapes stay: paragraphs, italics, a quote.

import { bookLinkOf } from '../../core/epub';
import { isNoteRef } from './book-links';
import { FRONT } from './front-matter';

/** The blocks between which a plain copy puts a blank line. */
const BLOCK = /^(?:P|DIV|LI|DD|DT|BLOCKQUOTE|H[1-6]|FIGURE|FIGCAPTION|PRE|TR)$/u;

/** Whether `element` is a note's reference: named so, or a book's link that reads as one (./book-links.ts). */
function isMark(element: Element): boolean {
  if (!(element instanceof HTMLAnchorElement)) return false;
  const link = bookLinkOf(element.getAttribute('href') ?? '');
  return element.dataset.part === 'note-ref' || (link !== null && isNoteRef(element, link));
}

/** `range`'s words and their shapes, with nothing of the page's own. */
export function wordsIn(range: Range): DocumentFragment {
  // Marks told apart where they stand (a sup round one), before the copy loses what's round it.
  const marks = new Set<Element>();
  const root = range.commonAncestorContainer;
  for (const anchor of root instanceof Element ? root.querySelectorAll('a[href]') : []) {
    if (range.intersectsNode(anchor) && isMark(anchor)) marks.add(anchor);
  }
  const words = range.cloneContents();
  const cloned = [...words.querySelectorAll('a[href]')];
  const originals =
    root instanceof Element
      ? [...root.querySelectorAll('a[href]')].filter((a) => range.intersectsNode(a))
      : [];
  cloned.forEach((copy, at) => {
    const original = originals[at];
    if (original && marks.has(original)) copy.setAttribute('data-mark', '');
  });
  for (const element of [...words.querySelectorAll('*')]) {
    // Eien's own front matter (./front-matter.ts) is none of the book's words.
    if (
      element.matches(
        `[data-mark], [data-part="note-ref"], a[data-anchor], img, .image-words, ${FRONT}`,
      )
    ) {
      const holder = element.parentElement;
      element.remove();
      // A mark's sup, left with nothing in it.
      if (holder?.matches('sup, sub') && holder.textContent?.trim() === '') holder.remove();
      continue;
    }
    for (const name of element.getAttributeNames()) element.removeAttribute(name);
    if (element.localName === 'a') element.replaceWith(...element.childNodes);
  }
  return words;
}

/** `words` as plain text: a blank line between blocks, spaces run together within them. */
export function plainText(words: DocumentFragment): string {
  const blocks: string[] = [];
  let line = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) line += (node.textContent ?? '').replace(/\s+/gu, ' ');
    // A line break kept: a verse's, a letter's.
    if (node instanceof Element && node.tagName === 'BR') line += '\n';
    const block = node instanceof Element && BLOCK.test(node.tagName);
    if (block) end();
    for (const child of node.childNodes) walk(child);
    if (block) end();
  };
  const end = () => {
    const words = line
      .split('\n')
      .map((part) => part.replace(/ +/gu, ' ').trim())
      .join('\n')
      .trim();
    if (words) blocks.push(words);
    line = '';
  };
  walk(words);
  end();
  return blocks.join('\n\n');
}

/** As markup, for a page that pastes it (a note's paste reads it as Markdown). */
export function markupOf(words: DocumentFragment): string {
  const holder = document.createElement('div');
  holder.append(words.cloneNode(true));
  return holder.innerHTML;
}

/** The part of `range` inside `root`, or null for none. */
function within(range: Range, root: Node): Range | null {
  if (!range.intersectsNode(root)) return null;
  const clipped = range.cloneRange();
  if (!root.contains(range.startContainer)) clipped.setStart(root, 0);
  if (!root.contains(range.endContainer)) clipped.setEnd(root, root.childNodes.length);
  return clipped;
}

/**
 * A copy of words in `root` (a chapter, a note over it) gives these words,
 * not what the page drew: however far the selection reaches past it. The
 * listener taken off, returned.
 */
export function copyWords(root: HTMLElement): () => void {
  const copied = (event: ClipboardEvent) => {
    const selection = document.getSelection();
    if (!event.clipboardData || !selection || selection.rangeCount === 0 || selection.isCollapsed)
      return;
    const range = within(selection.getRangeAt(0), root);
    if (!range) return;
    const words = wordsIn(range);
    event.preventDefault();
    event.clipboardData.setData('text/plain', plainText(words));
    event.clipboardData.setData('text/html', markupOf(words));
  };
  document.addEventListener('copy', copied);
  return () => document.removeEventListener('copy', copied);
}
