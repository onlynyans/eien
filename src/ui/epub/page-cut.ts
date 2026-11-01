// A page's words cut from its chapter (#40, Phase 3b), for a turn's copy of
// the page in sight (a spread's two, Phase 3d): a turn moves one sight,
// never the whole chapter. The cut runs from just after the page before's
// last word (so a picture beginning the page comes with it; the opening's
// from past Eien's front matter) to the next page's first. A paragraph the
// page begins inside of keeps no indent and no capitals: that's its middle.
// One it ends inside of is set to its end as on the page: justified, its
// last line too.

import { characterAt, OWN } from './chapter-place';
import { FRONT } from './front-matter';

/** The blocks a page may begin inside of. */
const BLOCKS = 'p, li, blockquote, dd, figcaption';

/** Whether `at`'s block has words before it: a page beginning there begins mid-paragraph. */
function begunBefore(at: Range): boolean {
  const block = at.startContainer.parentElement?.closest(BLOCKS);
  if (!block) return false;
  const before = document.createRange();
  before.setStart(block, 0);
  before.setEnd(at.startContainer, at.startOffset);
  return before.toString().trim() !== '';
}

/** What a page shows that isn't the book's words: a picture, a scene break. */
const MARKS = `img, hr, ${OWN}`;

/**
 * `range` kept to what the page in sight draws (#60): a picture or a scene
 * break the words would bring in stands on the page it's drawn on, never
 * brought to the head of the next or the foot of the one before; a chapter of
 * pictures alone has no words to go by. Measured in the chapter's box, where
 * the page in sight is; nothing laid, nothing moved. Whether the start moved.
 */
function keptToSight(range: Range, chapter: HTMLElement): boolean {
  const sight = chapter.parentElement?.getBoundingClientRect();
  if (!sight || sight.width === 0) return false;
  let moved = false;
  for (const mark of chapter.querySelectorAll(MARKS)) {
    if (!range.intersectsNode(mark)) continue;
    const at = mark.getBoundingClientRect();
    // A mark with no box (a picture not yet drawn) stays where the words put it.
    if (at.width === 0) continue;
    if (at.right <= sight.left) {
      range.setStartAfter(mark);
      moved = true;
    } else if (at.left >= sight.left + sight.width) {
      range.setEndBefore(mark);
      break;
    }
  }
  return moved;
}

/** Whether `node` shows something: words, a picture or a break. */
const shown = (node: Node): boolean =>
  node instanceof Element ? node.matches(MARKS) : node.textContent?.trim() !== '';

/** The first thing shown from `range`'s start on, found as soon as it's met. */
function firstShown(range: Range, chapter: HTMLElement): Node | null {
  const { startContainer: node, startOffset: offset } = range;
  if (node.nodeType === Node.TEXT_NODE && node.textContent?.slice(offset).trim()) return node;
  let next: Node | null =
    node.nodeType === Node.TEXT_NODE ? null : (node.childNodes[offset] ?? null);
  for (let at: Node | null = node; !next && at && at !== chapter; at = at.parentNode) {
    next = at.nextSibling;
  }
  if (!next) return null;
  const walk = document.createTreeWalker(chapter, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  walk.currentNode = next;
  for (let at: Node | null = next; at; at = walk.nextNode()) if (shown(at)) return at;
  return null;
}

/** The blocks the cut's start ends, the innermost first: their words all on the page before. */
function endedBy(range: Range, chapter: HTMLElement): Element[] {
  const first = firstShown(range, chapter);
  const { startContainer } = range;
  const ended: Element[] = [];
  let block = startContainer instanceof Element ? startContainer : startContainer.parentElement;
  for (; block && block !== chapter && !block.contains(first); block = block.parentElement) {
    ended.push(block);
  }
  return ended;
}

/**
 * `words`, cut by `range`, a page's after a break, set as the page in sight
 * sets them (#60). The blocks the page before finished come first as empty
 * copies: hidden, their gaps that page's, though still there for what
 * follows (a paragraph after another is indented). And what stands at the
 * page's head has no gap above it, as a break drops it in sight.
 */
function afterBreak(words: DocumentFragment, range: Range, chapter: HTMLElement): void {
  const ended = endedBy(range, chapter);
  // The copies opened at the cut's start, outermost first: the elements it's put back in, then the
  // blocks its start is inside of, the ended ones last.
  const opened: HTMLElement[] = [];
  for (let node = words.firstChild; node instanceof HTMLElement; node = node.firstChild) {
    opened.push(node);
  }
  const top = range.commonAncestorContainer;
  let wrapped = 0;
  for (let at: Node | null = top; at && at !== chapter; at = at.parentNode) {
    if (at.nodeType === Node.ELEMENT_NODE) wrapped++;
  }
  for (const block of ended) {
    let depth = 0;
    for (let at: Node | null = block; at && at !== top; at = at.parentNode) depth++;
    const shell = opened[wrapped + depth - 1];
    if (shell) shell.style.display = 'none';
  }
  // The first thing shown: words, a picture or a break. A hidden copy's are passed over.
  const walk = document.createTreeWalker(words, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      node instanceof HTMLElement && node.style.display === 'none'
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    if (!shown(node)) continue;
    const mark = node instanceof HTMLElement;
    for (let at = mark ? (node as HTMLElement) : node.parentElement; at; at = at.parentElement) {
      at.style.marginTop = '0';
    }
    return;
  }
}

/**
 * `chapter`'s words from just after `after` (the page before's last
 * character; its start for none) to `to` (the next page's first; its end for
 * none), `from` the page's own first character.
 */
export function pageCut(
  chapter: HTMLElement,
  after: Range | null,
  from: Range | null,
  to: Range | null,
): DocumentFragment {
  const range = document.createRange();
  range.selectNodeContents(chapter);
  const front = chapter.querySelector(`:scope > ${FRONT}`);
  if (after) range.setStart(after.endContainer, after.endOffset);
  else if (front) range.setStartAfter(front);
  if (to) range.setEnd(to.startContainer, to.startOffset);
  const moved = keptToSight(range, chapter);
  // Inside one paragraph, the cut holds its words alone: they're put back in its elements, shallow.
  let cut: Node = range.cloneContents();
  for (
    let at: Node | null = range.commonAncestorContainer;
    at && at !== chapter;
    at = at.parentNode
  ) {
    if (at.nodeType !== Node.ELEMENT_NODE) continue;
    const shell = at.cloneNode(false);
    shell.appendChild(cut);
    cut = shell;
  }
  const words = document.createDocumentFragment();
  words.append(cut);
  const first = words.querySelector<HTMLElement>(BLOCKS);
  if (from && first && begunBefore(from)) {
    first.style.textIndent = '0';
    // The capitals are a first line's alone; any other part (an epigraph, a caption) keeps its look.
    if (first.dataset.part === 'first-line') first.removeAttribute('data-part');
  }
  // The block the cut ends inside of: the one holding its last words, not the last one opened.
  const texts = document.createTreeWalker(words, NodeFilter.SHOW_TEXT);
  let end: Node | null = null;
  for (let text = texts.nextNode(); text; text = texts.nextNode()) end = text;
  const last = end?.parentElement?.closest<HTMLElement>(BLOCKS);
  if (to && last && begunBefore(to)) last.setAttribute(CUT_END, '');
  // A break before the page: the page before's words, or its pictures (a chapter of them alone).
  if (after || moved) afterBreak(words, range, chapter);
  return words;
}

/** Marks the block a cut ends inside of (./epub-set.css): its lines set as the page sets them. */
export const CUT_END = 'data-cut-end';

/** `chapter`'s words from offset `start` to `next` (its end for null): a sight's, for a turn's copy. */
export function sightCut(
  chapter: HTMLElement,
  start: number,
  next: number | null,
): DocumentFragment {
  const before = start > 0 ? characterAt(chapter, start - 1) : null;
  const from = start > 0 ? characterAt(chapter, start) : null;
  const to = next === null ? null : characterAt(chapter, next);
  return pageCut(chapter, before, from, to);
}
