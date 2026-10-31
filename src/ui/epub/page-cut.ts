// A page's words cut from its chapter (#40, Phase 3b), for a turn's copy of
// the page in sight (a spread's two, Phase 3d): a turn moves one sight,
// never the whole chapter. The cut runs from just after the page before's
// last word (so a picture beginning the page comes with it; the opening's
// from past Eien's front matter) to the next page's first. A paragraph the
// page begins inside of keeps no indent and no capitals: that's its middle.
// One it ends inside of is set to its end as on the page: justified, its
// last line too.

import { characterAt } from './chapter-place';
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
  const last = [...words.querySelectorAll<HTMLElement>(BLOCKS)].at(-1);
  if (to && last && begunBefore(to)) last.setAttribute(CUT_END, '');
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
