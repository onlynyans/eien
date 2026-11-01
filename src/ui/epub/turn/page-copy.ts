// The page as it was, to move while the book is already on the next (#40,
// Phase 3): a copy of its sheet laid exactly over it, seen and never
// reached. Hidden from assistive technology and the keyboard (inert), and
// with nothing of the book's that's found by name (ids, the places links
// name), so a turn in flight never makes a second of anything.

import { zoomOf } from '../../css-zoom';

/** Marks the copy's words: Slide and Words move them alone (./turn.css). */
export const WORDS = 'data-turn-words';

/** Marks what stays where it is as the page turns (a book's fore-edge): never copied. */
export const STAYS = 'data-turn-stays';

const NAMED = ['id', 'tabindex', 'data-anchor', 'aria-describedby', 'aria-labelledby'] as const;

/**
 * A copy of `sheet` as it is now, its words (the first `words` in it) marked,
 * and kept by `trim` (if given) to those round the sight; null where `trim`
 * has none to give.
 */
export function pageCopy(sheet: HTMLElement, words: string): HTMLElement;
export function pageCopy(
  sheet: HTMLElement,
  words: string,
  trim: (words: HTMLElement) => boolean,
): HTMLElement | null;
export function pageCopy(
  sheet: HTMLElement,
  words: string,
  trim?: (words: HTMLElement) => boolean,
): HTMLElement | null {
  const copy = sheet.cloneNode(true) as HTMLElement;
  copy.classList.add('turn-copy');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  for (const staying of copy.querySelectorAll(`[${STAYS}]`)) staying.remove();
  const marked = copy.querySelector<HTMLElement>(words);
  if (marked) {
    marked.setAttribute(WORDS, '');
    if (trim && !trim(marked)) return null;
  }
  // After the trim, whose words are the book's own again.
  const named = NAMED.map((name) => `[${name}]`).join(', ');
  for (const element of [copy, ...copy.querySelectorAll(named)]) {
    for (const name of NAMED) element.removeAttribute(name);
  }
  return copy;
}

/**
 * `copy` laid exactly over `sheet`, beside it in its parent, above it: out of
 * the flow whatever the sheet's own rules would make of it (a page's sheet
 * in pages fills its pane, and its copy mustn't take half). Offsets are whole
 * pixels, and a sheet under Page zoom stands at a part of one: the copy is
 * moved and sized to the sheet's own box as the window draws it.
 */
export function layOver(copy: HTMLElement, sheet: HTMLElement): void {
  Object.assign(copy.style, {
    position: 'absolute',
    margin: '0',
    left: `${sheet.offsetLeft}px`,
    top: `${sheet.offsetTop}px`,
    width: `${sheet.offsetWidth}px`,
    height: `${sheet.offsetHeight}px`,
  });
  sheet.after(copy);
  const want = sheet.getBoundingClientRect();
  const got = copy.getBoundingClientRect();
  // A sheet not laid out (a test's window) keeps its offsets.
  if (want.width === 0) return;
  // The copy's own lengths are drawn at its zoom: a rect's pixels are divided by it.
  const scale = zoomOf(copy);
  Object.assign(copy.style, {
    left: `${sheet.offsetLeft + (want.left - got.left) / scale}px`,
    top: `${sheet.offsetTop + (want.top - got.top) / scale}px`,
    width: `${want.width / scale}px`,
    height: `${want.height / scale}px`,
  });
}
