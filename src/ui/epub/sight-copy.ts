// A sight's words for a turn's copy of the page (#40, Phase 3b; #60): the
// chapter as it's laid, never laid another way. A copy of the whole chapter
// is too slow to lay (a long one's fourteen curl pieces took seconds), so the
// copy holds a run of whole blocks round the sight: from the block holding
// the last thing shown before it to the block holding the first thing shown
// after it, so whatever decides the break at its foot (a paragraph's widows,
// its last lines set, a heading kept with what follows) comes too. Laid in the chapter's own
// columns, its first block standing where it stands on the page, every line
// after breaks where the page's does.
//
// Where it stands is measured, not reckoned: the run is laid once beside the
// chapter, out of sight, and its first word set on the page's first word's
// place, down (a spacer above it in its column) and across (the copy's
// shift). Reckoned, a column's pitch under Page zoom is rounded to the
// window's layout unit, and the error grows with every column before.
//
// Nothing before the run reaches the sight but what's carried: the height
// (the spacer), the sibling a paragraph's indent looks back to (`p + p`,
// ./epub.css: a hidden shell of it), and a list's numbers (`value`).
// tests/epub-copy-css.test.ts holds the stylesheets to that.

import { OWN, offsetAfter } from './chapter-place';

/** A node's first box, in the window's coordinates: the window's own measure, or a test's. */
export type BoxOf = (node: Node) => Pick<DOMRect, 'left' | 'top'> | null;

/** The first box the window lays a node in: its first line, or its first column's part. */
export const firstBox: BoxOf = (node) => {
  if (node instanceof Element) return node.getClientRects()[0] ?? null;
  const range = document.createRange();
  range.selectNodeContents(node);
  return range.getClientRects()[0] ?? null;
};

export interface SightCopyOf {
  /** The box the chapter is laid in: the run is laid there once, out of sight, to be measured. */
  readonly box: HTMLElement;
  /** The sight's left edge and its right, in the window's coordinates. */
  readonly from: number;
  readonly past: number;
  /** Where the page is moved across to (its translate), and a column and its gap: the chapter's own pixels. */
  readonly at: number;
  readonly pitch: number;
  /** The zoom the window draws the chapter at: its rects are zoomed, its lengths aren't. */
  readonly scale: number;
  readonly boxOf?: BoxOf;
}

export interface SightCopy {
  readonly words: DocumentFragment;
  /** Where the copy is moved across to, in place of the page's `at`. */
  readonly shift: number;
  /** The offset in the chapter's words of the copy's first word: its ink's start. */
  readonly from: number;
}

/**
 * The most characters a run may hold: a copy's laying costs about a
 * microsecond a character, and a curl lays fourteen. Runs are a sight and a
 * paragraph either side; one block as long as a chapter (lines broken by
 * `<br>` alone) would make every copy the chapter, and such a page turns
 * without one.
 */
export const RUN_CHARACTERS = 16_000;

/** What the page shows: a picture, a rule, or Eien's own in the book's place (a break's marks, the front matter). */
const MARKS = `img, hr, ${OWN}`;

/** The boxes a block is laid in as one of the column's own: never a line's piece, a cell or a row. */
const BLOCK_LEVEL = /^(block|list-item|flow-root|table|flex|grid)$/u;

/** A layout unit, in the window's (zoomed) pixels: what's measured is exact to it. */
const UNIT = 1 / 64;

/** What `within` shows, in the order it reads: its words' pieces and its marks, itself if it's one. */
function shownIn(within: Element): Node[] {
  const shown: Node[] = within.matches(MARKS) ? [within] : [];
  const walk = document.createTreeWalker(within, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walk.nextNode(); node; node = walk.nextNode()) {
    const counts =
      node instanceof Element
        ? node.matches(MARKS)
        : node.textContent?.trim() !== '' && !node.parentElement?.closest(OWN);
    if (counts) shown.push(node);
  }
  return shown;
}

/**
 * Where in `shown` the last whose first box begins left of `edge` is, by
 * halves (-1 for none). One with no box counts as `boxless`, so an error
 * falls on the safe side: the run's start never later than the page's, its
 * end never earlier.
 */
function lastBefore(shown: readonly Node[], edge: number, boxOf: BoxOf, boxless: boolean) {
  let low = 0;
  let high = shown.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    const box = boxOf(shown[middle] as Node);
    if (box ? box.left < edge : boxless) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}

/** The block `node` is laid in, below `chapter`; null for the chapter itself. */
function blockOf(node: Node | null, chapter: HTMLElement): Element | null {
  for (
    let at = node instanceof Element ? node : (node?.parentElement ?? null);
    at && at !== chapter;
    at = at.parentElement
  ) {
    if (BLOCK_LEVEL.test(getComputedStyle(at).display)) return at;
  }
  return null;
}

/** `range`'s words, put back in shallow copies of the elements it lies in below `chapter`. */
function cloned(range: Range, chapter: HTMLElement): DocumentFragment {
  let words: Node = range.cloneContents();
  for (let at = range.commonAncestorContainer; at !== chapter; at = at.parentNode as Node) {
    const shell = at.cloneNode(false);
    shell.appendChild(words);
    words = shell;
  }
  const fragment = document.createDocumentFragment();
  fragment.append(words);
  return fragment;
}

/**
 * Each element from `chapter`'s child down to `start`, with its copy in
 * `words`, outermost first: each opened but `start`, which is copied whole.
 */
function opened(words: DocumentFragment, start: Element, chapter: HTMLElement): Element[][] {
  const chain: Element[] = [];
  for (let at: Node | null = start; at && at !== chapter; at = at.parentNode) {
    if (at instanceof Element) chain.unshift(at);
  }
  const copies: Element[][] = [];
  let copy: Node | null = words;
  for (const element of chain) {
    copy = copy?.firstChild ?? null;
    if (copy instanceof Element) copies.push([element, copy]);
  }
  return copies;
}

/** `copy`, the copy of `element`, given what its look on the page depends on before it. */
function carry(element: Element, copy: HTMLElement, opening: boolean): void {
  const before = element.previousElementSibling;
  if (before) {
    const shell = before.cloneNode(false) as HTMLElement;
    shell.style.display = 'none';
    copy.before(shell);
  }
  // A numbered item's number, which its siblings before it counted.
  if (element.localName === 'li' && element.parentElement?.localName === 'ol') {
    const siblings = [...element.parentElement.children].filter((each) => each.localName === 'li');
    copy.setAttribute('value', String(siblings.indexOf(element) + 1));
  }
  // Drawn above the start, in a column out of sight: the start alone stands where the spacer ends.
  copy.style.marginTop = '0px';
  if (!opening) return;
  copy.style.paddingTop = '0px';
  copy.style.borderTopWidth = '0px';
}

/** The spacer `spacer` set `height` tall: a gap above, or (short of none) a pull up past a margin. */
function stand(spacer: HTMLElement, height: number): void {
  spacer.style.height = `${Math.max(0, height)}px`;
  spacer.style.marginBottom = height < 0 ? `${height}px` : '0px';
}

/**
 * `chapter`'s words round the sight `of`, set to lie where the page lays
 * them; null for a run too long to copy (RUN_CHARACTERS).
 */
export function sightCopy(chapter: HTMLElement, of: SightCopyOf): SightCopy | null {
  const boxOf = of.boxOf ?? firstBox;
  const shown = shownIn(chapter);
  const start = blockOf(shown[lastBefore(shown, of.from, boxOf, false)] ?? null, chapter);
  const end = blockOf(shown[lastBefore(shown, of.past, boxOf, true) + 1] ?? null, chapter);
  const range = document.createRange();
  range.selectNodeContents(chapter);
  if (start) range.setStartBefore(start);
  // An end before the start (boxes out of order) keeps the rest of the chapter: never too little.
  // One holding the start (a block's own words past the sight, after the block the start is) ends
  // after it.
  const placed = start ? start.compareDocumentPosition(end ?? start) : 0;
  if (
    end &&
    (!(placed & Node.DOCUMENT_POSITION_PRECEDING) || placed & Node.DOCUMENT_POSITION_CONTAINS)
  ) {
    range.setEndAfter(end);
  }
  const words = cloned(range, chapter);
  if ((words.textContent?.length ?? 0) > RUN_CHARACTERS) return null;
  const laid = chapter.getBoundingClientRect();
  const first = start ? boxOf(start) : null;
  const column = first ? Math.round((first.left - laid.left) / of.scale / of.pitch) : 0;
  // From the chapter's start, the run lies in the chapter's own columns already.
  if (!start) return { words, shift: of.at, from: 0 };
  // A start with no box can't be set where the page has it.
  if (!first) return null;
  const copies = opened(words, start, chapter);
  const startCopy = copies.at(-1)?.[1];
  copies.forEach(([element, copy], i) => {
    carry(element as Element, copy as HTMLElement, i < copies.length - 1);
  });
  const spacer = document.createElement('div');
  // The start's height in its column: none (at a column's head) and no spacer, where the page broke.
  // In CSS pixels from the layout's units: a quarter unit more, so a window that truncates to its
  // units lays it no shorter, and one that rounds no longer.
  const top = first.top - laid.top;
  let height = top > 0 ? (top + UNIT / 4) / of.scale : 0;
  if (height > 0) stand(spacer, height);
  // Laid once, beside the chapter and out of sight, to be measured: its first word on the page's.
  const probe = chapter.cloneNode(false) as HTMLElement;
  Object.assign(probe.style, { position: 'absolute', left: '0', top: '0', visibility: 'hidden' });
  let shift = of.at - column * of.pitch;
  probe.style.transform = `translateX(${-shift}px)`;
  probe.append(...(height > 0 ? [spacer] : []), words);
  of.box.append(probe);
  // The start's first word (or picture, or rule) on the page, and in the run.
  const word = shownIn(start)[0];
  const page = word ? boxOf(word) : null;
  for (let tries = 1; page && startCopy && tries <= 3; tries++) {
    const copied = shownIn(startCopy)[0];
    const box = copied ? boxOf(copied) : null;
    if (!box) break;
    const down = box.top - page.top;
    if (Math.abs(down) < UNIT / 2 || tries === 3) {
      shift += (box.left - page.left) / of.scale;
      break;
    }
    // A margin the start's first block collapses through it, or one a break dropped: measured away.
    height -= down / of.scale;
    stand(spacer, height);
    if (!spacer.isConnected) probe.prepend(spacer);
  }
  probe.remove();
  const kept = document.createDocumentFragment();
  kept.append(...probe.childNodes);
  return { words: kept, shift, from: offsetAfter(chapter, start) };
}
