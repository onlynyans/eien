// A book opened (#40): its zip read and checked (./zip-read.ts), its package
// (./package.ts) and contents (./contents.ts), and its chapters and pictures
// read one at a time as they're shown. A file from anywhere ends in a book or
// a refusal (./refusal.ts), never a throw. The book's file is only read.

import { imageInfo } from '../export/images';
import { baseName } from '../paths';
import { imageTypeOf } from '../vault';
import { EPUB_CAPS, type EpubCaps } from './caps';
import { type Chapter, chapterOf } from './chapter';
import { type ContentsEntry, contentsOf, type PrintPage, printPagesOf } from './contents';
import { readPackage, type SpineItem } from './package';
import { isRefusal, type Refusal, refuse } from './refusal';
import { xmlOf } from './xml-nodes';
import { type Inflate, openZip, type ZipArchive, type ZipEntry } from './zip-read';

export interface EpubImage {
  readonly bytes: Uint8Array;
  /** Its media type, as a note's image of its kind has. */
  readonly type: string;
  /** Its pixels, from its own header, where Eien reads one (PNG, JPEG, GIF): the room it takes before it's shown. */
  readonly size: { readonly width: number; readonly height: number } | null;
}

/** A spine item, with its size: how much of the book it is (./progress.ts). */
export interface EpubSpineItem extends SpineItem {
  /** Its size in bytes, inflated, as the zip's directory declares it. */
  readonly size: number;
}

export interface Epub {
  readonly title: string;
  readonly author: string;
  readonly language: string;
  /** Who the book is, from what it holds: the same renamed, moved or zipped again (./reading.ts keeps state by it). */
  readonly key: string;
  readonly spine: readonly EpubSpineItem[];
  readonly contents: readonly ContentsEntry[];
  /** The printed edition's pages, where the book has a page-list. */
  readonly printPages: readonly PrintPage[];
  /** The spine's item `index`, read and cleaned. */
  chapter(index: number): Promise<Chapter | Refusal>;
  /** A picture a chapter shows, by its path in the zip. */
  image(path: string): Promise<EpubImage | Refusal>;
}

/**
 * Who a book is, from its entries' names, CRCs and sizes: FNV-1a over them,
 * 64 bits, in hex. Not a guard against forgery (a book made to match another
 * would share its place), only a name that travels with what the book holds.
 */
export function epubKey(entries: readonly ZipEntry[]): string {
  const PRIME = 0x100_0000_01b3n;
  const MASK = 0xffff_ffff_ffff_ffffn;
  let hash = 0xcbf2_9ce4_8422_2325n;
  const lines = entries
    .map((entry) => `${entry.name}\u0000${entry.crc}\u0000${entry.size}\n`)
    .sort();
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      hash = ((hash ^ BigInt(line.charCodeAt(i))) * PRIME) & MASK;
    }
  }
  return hash.toString(16).padStart(16, '0');
}

/** The XML at `path` as nodes, or null when the book has none there or it can't be read. */
async function xmlAt(zip: ZipArchive, path: string | null, caps: EpubCaps) {
  if (!path) return null;
  const bytes = await zip.read(path, caps.text);
  return bytes instanceof Uint8Array ? xmlOf(bytes) : null;
}

/** Turn anything thrown into a refusal: the last guard, never the first. */
async function guarded<T>(work: () => Promise<T | Refusal>): Promise<T | Refusal> {
  try {
    return await work();
  } catch (error) {
    return refuse('damaged', `unreadable: ${String(error)}`);
  }
}

/** The book `bytes` hold, its entries inflated by `inflate`, or why it won't open. */
export function openEpub(
  bytes: Uint8Array,
  inflate: Inflate,
  caps: EpubCaps = EPUB_CAPS,
): Promise<Epub | Refusal> {
  return guarded(async () => {
    const zip = openZip(bytes, inflate, caps);
    if (isRefusal(zip)) return zip;
    const pkg = await readPackage(zip, caps);
    if (isRefusal(pkg)) return pkg;
    const sources = { nav: await xmlAt(zip, pkg.nav, caps), ncx: await xmlAt(zip, pkg.ncx, caps) };
    const contents = contentsOf(pkg, sources);
    if (contents.length === 0) return refuse('empty', 'no chapter to show');
    const sizes = new Map(zip.entries.map((entry) => [entry.name, entry.size]));
    const chapters = new Set(pkg.spine.map((item) => item.path));
    const isChapter = (name: string) => chapters.has(name);
    return {
      title: pkg.title,
      author: pkg.author,
      language: pkg.language,
      key: epubKey(zip.entries),
      spine: pkg.spine.map((item) => ({ ...item, size: sizes.get(item.path) ?? 0 })),
      contents,
      printPages: printPagesOf(pkg, sources),
      chapter: (index) =>
        guarded(async () => {
          const item = pkg.spine[index];
          if (!item) return refuse('damaged', `no spine item ${index}`);
          const read = await zip.read(item.path, caps.text);
          return isRefusal(read) ? read : chapterOf(read, item.path, zip.has, isChapter);
        }),
      image: (path) =>
        guarded(async () => {
          const type = imageTypeOf(baseName(path));
          if (!type) return refuse('unsupported', `${path} isn’t a picture Eien shows`);
          const read = await zip.read(path, caps.image);
          if (isRefusal(read)) return read;
          const info = imageInfo(read);
          return { bytes: read, type, size: info && { width: info.width, height: info.height } };
        }),
    };
  });
}
