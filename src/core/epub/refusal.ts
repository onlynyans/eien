// Why a book can't be opened (#40). Every check in core/epub ends in a book
// or one of these, never a throw: a file from anywhere is read as hostile,
// and the window says plainly why it won't show it.

/** What kind of no it is: the window's words come from it, once, here. */
export type RefusalKind =
  /** Not a zip, or not an EPUB inside (no container, no package). */
  | 'not-epub'
  /** Past a cap: the file, an entry, the whole or the ratio between them. */
  | 'too-large'
  /** Encrypted, or locked with DRM. */
  | 'locked'
  /** Not what it says it is: a CRC, a size, a header that disagrees. */
  | 'damaged'
  /** A name that would leave the zip, or two entries of one name. */
  | 'unsafe'
  /** Readable in principle, not by Eien: Zip64, a split archive, a compression it doesn't know. */
  | 'unsupported'
  /** Nothing to read: a spine with no chapters. */
  | 'empty';

export interface Refusal {
  readonly refused: RefusalKind;
  /** What was wrong, for the log and the tests: never shown as the reason itself. */
  readonly detail: string;
}

export const refuse = (refused: RefusalKind, detail: string): Refusal => ({ refused, detail });

export const isRefusal = (value: unknown): value is Refusal =>
  typeof value === 'object' && value !== null && 'refused' in value;

const WORDS: Readonly<Record<RefusalKind, string>> = {
  'not-epub': 'This file isn’t an EPUB that Eien can read.',
  'too-large': 'This book is too large for Eien to open safely.',
  locked: 'This book is locked with DRM, so Eien can’t open it.',
  damaged: 'This book is damaged: part of it doesn’t read back as it should.',
  unsafe: 'This book names a file in a way that isn’t safe, so Eien won’t open it.',
  unsupported: 'This book is packed in a way Eien can’t read yet.',
  empty: 'This book has no chapters to show.',
};

/** What the window says about `refusal`. */
export const refusalWords = (refusal: Refusal): string => WORDS[refusal.refused];
