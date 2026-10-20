// CommonMark's flanking rule, as the editor's parser (Lezer) applies it to
// "*", "~~" and Eien's "==": whether a run of marks between two characters
// can open or close. "a**, b**" can't open, so its stars show on the page.

/** Punctuation and symbols, as Lezer counts them. */
const PUNCTUATION = /[\p{S}\p{P}]/u;

/**
 * Whether a run of marks with `before` and `after` beside it (one UTF-16
 * unit each, as the parser reads them; "" at the text's ends) can open and
 * can close.
 */
export function flanking(before: string, after: string): { open: boolean; close: boolean } {
  const spaceBefore = /\s|^$/.test(before);
  const spaceAfter = /\s|^$/.test(after);
  const punctBefore = PUNCTUATION.test(before);
  const punctAfter = PUNCTUATION.test(after);
  return {
    open: !spaceAfter && (!punctAfter || spaceBefore || punctBefore),
    close: !spaceBefore && (!punctBefore || spaceAfter || punctAfter),
  };
}
