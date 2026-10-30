// The page as it was, to move while the book is already on the next (#40,
// Phase 3): a copy of its sheet laid exactly over it, seen and never
// reached. Hidden from assistive technology and the keyboard (inert), and
// with nothing of the book's that's found by name (ids, the places links
// name), so a turn in flight never makes a second of anything.

/** Marks the copy's words: Slide and Words move them alone (./turn.css). */
export const WORDS = 'data-turn-words';

const NAMED = ['id', 'tabindex', 'data-anchor', 'aria-describedby', 'aria-labelledby'] as const;

/** A copy of `sheet` as it is now, its words (the first `words` in it) marked. */
export function pageCopy(sheet: HTMLElement, words: string): HTMLElement {
  const copy = sheet.cloneNode(true) as HTMLElement;
  copy.classList.add('turn-copy');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  const named = NAMED.map((name) => `[${name}]`).join(', ');
  for (const element of [copy, ...copy.querySelectorAll(named)]) {
    for (const name of NAMED) element.removeAttribute(name);
  }
  copy.querySelector(words)?.setAttribute(WORDS, '');
  return copy;
}

/** `copy` laid exactly over `sheet`, beside it in its parent, above it. */
export function layOver(copy: HTMLElement, sheet: HTMLElement): void {
  Object.assign(copy.style, {
    left: `${sheet.offsetLeft}px`,
    top: `${sheet.offsetTop}px`,
    width: `${sheet.offsetWidth}px`,
    height: `${sheet.offsetHeight}px`,
  });
  sheet.after(copy);
}
