// Names for new files beside existing ones: a fresh note, a conflict copy,
// a recovered draft. None ever replaces a file that's there.

import { MAX_MADE_NAME_BYTES, nameKey, safeName, utf8Length } from './names';
import { baseName, joinPath, parentOf } from './vault-path';

export const NOTE_EXTENSION = '.md';

/** A note's title: its file name without ".md". */
export const titleOf = (fileName: string): string =>
  fileName.toLowerCase().endsWith(NOTE_EXTENSION)
    ? fileName.slice(0, -NOTE_EXTENSION.length)
    : fileName;

/**
 * "<title><suffix>.md", or "<title><suffix> 2.md", " 3"… — the first not in
 * `taken` (compared as the file system would: case and normalisation
 * ignored). A long title is shortened, never the suffix.
 */
export function freeNoteName(title: string, taken: Iterable<string>, suffix = ''): string {
  return freeName(title, taken, NOTE_EXTENSION, suffix);
}

/** As freeNoteName, for any name: "<base><suffix><extension>", then " 2", " 3"… */
export function freeName(
  base: string,
  taken: Iterable<string>,
  extension = '',
  suffix = '',
): string {
  const used = new Set([...taken].map(nameKey));
  for (let n = 1; ; n++) {
    const tail = `${suffix}${n === 1 ? '' : ` ${n}`}${extension}`;
    const name = safeName(base, 'Untitled', MAX_MADE_NAME_BYTES - utf8Length(tail)) + tail;
    if (!used.has(nameKey(name))) return name;
  }
}

export type Renamed =
  | { readonly ok: true; readonly path: string }
  | { readonly ok: false; readonly problem: 'empty' | 'taken' };

/**
 * Where `path` goes when the writer renames it `typed`: a note's title (its
 * extension kept as it was), or a folder's name. `siblings` are the names
 * beside it. A change of case alone is the same file; a name another file
 * has is refused, never numbered: the writer chose it.
 */
export function renamedPath(
  path: string,
  typed: string,
  siblings: Iterable<string>,
  isNote: boolean,
): Renamed {
  const name = baseName(path);
  const extension = isNote ? name.slice(titleOf(name).length) : '';
  const base = safeName(typed, '', MAX_MADE_NAME_BYTES - utf8Length(extension));
  if (!base) return { ok: false, problem: 'empty' };
  const next = base + extension;
  if (
    nameKey(next) !== nameKey(name) &&
    [...siblings].some((sibling) => nameKey(sibling) === nameKey(next))
  ) {
    return { ok: false, problem: 'taken' };
  }
  return { ok: true, path: joinPath(parentOf(path), next) };
}

/**
 * Where `path` lands when moved into `folder`: under its own name, or, when
 * that's taken there, the first free one ("Name 2").
 */
export function movedPath(
  path: string,
  folder: string,
  taken: Iterable<string>,
  isNote: boolean,
): string {
  const name = baseName(path);
  const names = [...taken];
  if (!names.some((other) => nameKey(other) === nameKey(name))) return joinPath(folder, name);
  const extension = isNote ? name.slice(titleOf(name).length) : '';
  return joinPath(folder, freeName(isNote ? titleOf(name) : name, names, extension));
}

/** "2026-10-19 16-40": a local date and time that's a valid name everywhere. */
export function stampOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}-${pad(date.getMinutes())}`;
}

/** "Note (conflict 2026-10-19 16-40).md" beside "Note.md" (spec §3). */
export const conflictName = (fileName: string, date: Date, taken: Iterable<string>): string =>
  freeNoteName(titleOf(fileName), taken, ` (conflict ${stampOf(date)})`);

/** "Note (recovered 2026-10-19 16-40).md": a draft found after a crash. */
export const recoveredName = (fileName: string, date: Date, taken: Iterable<string>): string =>
  freeNoteName(titleOf(fileName), taken, ` (recovered ${stampOf(date)})`);
