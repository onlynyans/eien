// How much of a book Eien will read (#40). A book is a zip from anywhere, so
// every size is checked twice: as the zip declares it, before anything is
// inflated, and as the bytes come, which stop at the declared size.

import { MAX_IMAGE_BYTES, MAX_NOTE_BYTES } from '../vault';

export interface EpubCaps {
  /** The whole file: what the storage reads in one piece (platform/storage.ts MAX_BYTES_READ). */
  readonly file: number;
  /** Entries in the zip. */
  readonly entries: number;
  /** One entry Eien reads as text (a chapter, the package, its contents): a note's cap. */
  readonly text: number;
  /** One picture: the cap on a note's images. */
  readonly image: number;
  /** Every entry together, inflated. */
  readonly total: number;
  /** How many times larger an entry may inflate than it's stored… */
  readonly ratio: number;
  /** …once it's over this: a small file packs as it likes. */
  readonly ratioFrom: number;
}

const MIB = 1024 * 1024;

export const EPUB_CAPS: EpubCaps = {
  file: MAX_IMAGE_BYTES,
  entries: 10_000,
  text: MAX_NOTE_BYTES,
  image: MAX_IMAGE_BYTES,
  total: 256 * MIB,
  ratio: 100,
  ratioFrom: 64 * 1024,
};
