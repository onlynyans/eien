// The page as it was, to move while the book is already on the next (#40,
// Phase 3): a copy of its sheet laid exactly over it, seen and never
// reached. Hidden from assistive technology and the keyboard (inert), and
// with nothing of the book's that's found by name (ids, the places links
// name), so a turn in flight never makes a second of anything.

/** Marks the copy's words: Slide and Words move them alone (./turn.css). */
export const WORDS = 'data-turn-words';

/** Marks what stays where it is as the page turns (a book's fore-edge): never copied. */
export const STAYS = 'data-turn-stays';

const NAMED = ['id', 'tabindex', 'data-anchor', 'aria-describedby', 'aria-labelledby'] as const;

/**
 * A copy of `sheet` as it is now, its words (the first `words` in it) marked,
 * and cut by `trim` (if given) to what's in sight.
 */
export function pageCopy(
  sheet: HTMLElement,
  words: string,
  trim?: (words: HTMLElement) => void,
): HTMLElement {
  const copy = sheet.cloneNode(true) as HTMLElement;
  copy.classList.add('turn-copy');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  for (const staying of copy.querySelectorAll(`[${STAYS}]`)) staying.remove();
  const named = NAMED.map((name) => `[${name}]`).join(', ');
  for (const element of [copy, ...copy.querySelectorAll(named)]) {
    for (const name of NAMED) element.removeAttribute(name);
  }
  const marked = copy.querySelector<HTMLElement>(words);
  if (marked) {
    marked.setAttribute(WORDS, '');
    trim?.(marked);
  }
  return copy;
}

/**
 * `copy` laid exactly over `sheet`, beside it in its parent, above it: out of
 * the flow whatever the sheet's own rules would make of it (a page's sheet
 * in pages fills its pane, and its copy mustn't take half).
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
}
