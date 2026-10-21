// Import a folder of Markdown from elsewhere (spec §8): which of its files
// come into the vault, under what names, and why the rest don't. Nothing is
// decided by what's on disk at the moment of writing: the plan is made from
// the folder's listing and the vault's names, and the copy only follows it.

import {
  extensionOf,
  freeName,
  isHiddenName,
  joinPath,
  NOTE_EXTENSION,
  nameKey,
  nameProblems,
} from '../paths';
import { imageTypeOf } from '../vault';

/** A file in the folder being imported: its path in it ("/" separated) and its size in bytes. */
export interface SourceFile {
  readonly path: string;
  readonly size: number;
}

/** Why a file didn't come in. */
export type LeftReason =
  | 'not-a-note'
  | 'too-large'
  | 'bad-name'
  | 'too-many'
  | 'not-looked-at'
  | 'too-deep'
  | 'link'
  | 'unreadable'
  | 'not-utf8'
  | 'taken'
  | 'unwritten';

export interface LeftOut {
  /** Its path in the folder imported. */
  readonly path: string;
  readonly reason: LeftReason;
}

export interface Copy {
  readonly from: string;
  /** Where it goes in the vault. */
  readonly to: string;
  readonly kind: 'note' | 'image';
}

/** What an import did: what the window shows of it. */
export interface ImportReport {
  /** The folder made at the vault's top; null when no note came in (and nothing was made). */
  readonly folder: string | null;
  /** How many notes came in. */
  readonly copied: number;
  /** How many images came in. */
  readonly images: number;
  readonly left: readonly LeftOut[];
}

export interface ImportPlan {
  /** The new folder at the vault's top that everything goes into. */
  readonly folder: string;
  readonly copies: readonly Copy[];
  readonly left: readonly LeftOut[];
}

/** Extensions a note may have elsewhere; each comes in as ".md". */
export const NOTE_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mkd', '.txt'] as const;

/** The most notes one import brings in; and as many images besides. */
export const MAX_IMPORT_NOTES = 10_000;

/** The note's title when `name` is a note's name elsewhere, else null. */
export function noteTitle(name: string): string | null {
  const lower = name.toLowerCase();
  const extension = NOTE_EXTENSIONS.find((each) => lower.endsWith(each));
  if (!extension || name.length === extension.length) return null;
  return name.slice(0, name.length - extension.length);
}

/** Code-unit order, the same on every system, so a plan is the same everywhere. */
const byPath = (a: SourceFile, b: SourceFile) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/**
 * What to copy from a folder named `folderName`, holding `files`, into a
 * vault whose top holds `vaultNames`: its notes and images, each up to its
 * kind's most bytes.
 */
export function planImport(
  files: readonly SourceFile[],
  folderName: string,
  vaultNames: Iterable<string>,
  limits: { readonly note: number; readonly image: number },
): ImportPlan {
  const folder = freeName(folderName, vaultNames, '', '');
  /** Names taken in each folder made, by its vault path. */
  const taken = new Map<string, Set<string>>();
  /** Each source folder's place in the vault. */
  const placed = new Map<string, string>([['', folder]]);
  const takenIn = (at: string): Set<string> => {
    const names = taken.get(at) ?? new Set<string>();
    taken.set(at, names);
    return names;
  };

  /** The vault folder for a source folder, named (and numbered) as it's first needed. */
  const folderFor = (source: string): string => {
    const known = placed.get(source);
    if (known !== undefined) return known;
    const slash = source.lastIndexOf('/');
    const parent = folderFor(slash === -1 ? '' : source.slice(0, slash));
    const name = source.slice(slash + 1);
    const names = takenIn(parent);
    const free = names.has(nameKey(name)) ? freeName(name, [...names]) : name;
    names.add(nameKey(free));
    const path = joinPath(parent, free);
    placed.set(source, path);
    return path;
  };

  const copies: Copy[] = [];
  const left: LeftOut[] = [];
  const brought = { note: 0, image: 0 };
  for (const file of [...files].sort(byPath)) {
    const parts = file.path.split('/');
    if (parts.some(isHiddenName)) continue; // .obsidian, .git, .DS_Store: not the writer's notes
    const name = parts[parts.length - 1] as string;
    const title = noteTitle(name);
    // A note comes in as ".md"; an image under its own name.
    const kind = title !== null ? 'note' : imageTypeOf(name) ? 'image' : null;
    const named = title === null ? name : title + NOTE_EXTENSION;
    const badName = [...parts, named].some((part) => nameProblems(part).length > 0);
    const reason: LeftReason | null =
      kind === null
        ? 'not-a-note'
        : badName
          ? 'bad-name'
          : file.size > limits[kind]
            ? 'too-large'
            : brought[kind] >= MAX_IMPORT_NOTES
              ? 'too-many'
              : null;
    if (reason !== null || kind === null) {
      left.push({ path: file.path, reason: reason ?? 'not-a-note' });
      continue;
    }
    const at = folderFor(parts.slice(0, -1).join('/'));
    const names = takenIn(at);
    // Its own name, as it was; numbered only when another has it.
    const extension = kind === 'note' ? NOTE_EXTENSION : extensionOf(name);
    const free = names.has(nameKey(named))
      ? freeName(named.slice(0, named.length - extension.length), names, extension)
      : named;
    names.add(nameKey(free));
    copies.push({ from: file.path, to: joinPath(at, free), kind });
    brought[kind] += 1;
  }
  return { folder, copies, left };
}

/** What a reason means, for the writer. */
export const LEFT_REASONS: Readonly<Record<LeftReason, string>> = {
  'not-a-note': 'neither a note nor an image',
  'too-large': 'too large: a note may be 8 MB, an image 32 MB',
  'bad-name': 'a name some systems can’t hold',
  'too-many': `past the ${MAX_IMPORT_NOTES.toLocaleString('en-US')} notes (or images) one import brings`,
  'not-looked-at': `not looked at, nor anything after it: one import looks at ${(10 * MAX_IMPORT_NOTES).toLocaleString('en-US')} files`,
  'too-deep': 'in folders more than 64 deep, not looked into',
  link: 'a link, which isn’t followed',
  unreadable: 'couldn’t be read',
  'not-utf8': 'not UTF-8 text',
  taken: 'its name kept being taken',
  unwritten: 'couldn’t be written',
};
