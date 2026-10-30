// A page's words cut from its chapter (#40, Phase 3b), for a turn's copy of
// the page in sight: a turn moves one page, never the whole chapter. The cut
// runs from just after the page before's last word (so a picture beginning
// the page comes with it) to the next page's first. A paragraph the page
// begins inside of keeps no indent and no capitals: that's its middle.

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
  if (after) range.setStart(after.endContainer, after.endOffset);
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
  return words;
}
