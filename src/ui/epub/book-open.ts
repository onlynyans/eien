// A book opened for its page (#40): its file read from the vault (only ever
// read) and opened by core/epub, or the words its page says instead (gone,
// too large, unreadable, refused and why); what it's called; and where it
// opens: the place a page left (⇄, a page replaced), else the reading
// state's, else its first chapter in the contents.

import {
  EPUB_CAPS,
  type Epub,
  isRefusal,
  openEpub,
  type Reading,
  refusalWords,
} from '../../core/epub';
import { baseName } from '../../core/paths';
import { epubTitleOf } from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';
import { inflateRaw } from '../../platform/inflate';

export interface BookOpenOf {
  readonly vault: Pick<VaultBridge, 'readBytes'>;
  /** The size the vault lists for `path`, or null for none: a book listed past the read cap is too large. */
  sizeOf(path: string): number | null;
}

/** The book at `path`, open; or what its page says instead. */
export async function openBook(
  of: BookOpenOf,
  path: string,
): Promise<{ readonly epub: Epub } | { readonly notice: string }> {
  const bytes = await of.vault.readBytes(path).catch(() => null);
  if (!bytes) {
    const size = of.sizeOf(path);
    return {
      notice:
        size === null
          ? 'This book isn’t there any more.'
          : size > EPUB_CAPS.file
            ? refusalWords({ refused: 'too-large', detail: '' })
            : 'This book couldn’t be read. Try again in a moment.',
    };
  }
  const opened = await openEpub(bytes, inflateRaw);
  if (!isRefusal(opened)) return { epub: opened };
  console.warn(`Eien: ${path} wasn’t opened: ${opened.detail}`);
  return { notice: refusalWords(opened) };
}

/** What a book's page is called: its own title, or with none its file's name. */
export const nameOf = (epub: Epub | null, path: string): string =>
  epub?.title || epubTitleOf(baseName(path));

/** Where `epub` opens: the spine item `at` a page left, else the reading state's `kept`, else its first chapter. */
export function startOf(
  epub: Epub,
  at: { readonly spine: number; readonly offset: number } | null,
  kept: Reading | null,
): { readonly index: number; readonly offset: number } {
  if (at && at.spine >= 0 && at.spine < epub.spine.length)
    return { index: at.spine, offset: at.offset };
  const fromState = kept?.chapter ? epub.spine.findIndex((item) => item.path === kept.chapter) : -1;
  if (fromState >= 0) return { index: fromState, offset: kept?.offset ?? 0 };
  return { index: epub.contents[0]?.spine ?? 0, offset: 0 };
}
