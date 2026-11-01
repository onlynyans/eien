// Words as a pattern that matches them as written: the find bar's seed
// with Pattern on (ui/find/find-bar.ts), and a book's words found as written
// (#40, core/epub/find.ts). Only what a pattern reads as more than itself is
// escaped: a hyphen is a word's own outside a class, and escaping it is an
// error under the `u` flag.

export const escapePattern = (words: string): string =>
  words.replace(/[\\^$.*+?()[\]{}|/]/g, '\\$&');
