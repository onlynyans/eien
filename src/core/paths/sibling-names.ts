// Names for new files beside existing ones: a fresh note, a conflict copy,
// a recovered draft. None ever replaces a file that's there.

import { MAX_NAME_BYTES, nameKey, safeName, utf8Length } from './names';

const NOTE_EXTENSION = '.md';

/** A note's title: its file name without ".md". */
export const titleOf = (fileName: string): string =>
  fileName.toLowerCase().endsWith(NOTE_EXTENSION) ? fileName.slice(0, -NOTE_EXTENSION.length) : fileName;

/**
 * "<title><suffix>.md", or "<title><suffix> 2.md", " 3"… — the first not in
 * `taken` (compared as the file system would: case and normalisation
 * ignored). A long title is shortened, never the suffix.
 */
export function freeNoteName(title: string, taken: Iterable<string>, suffix = ''): string {
  const used = new Set([...taken].map(nameKey));
  for (let n = 1; ; n++) {
    const tail = `${suffix}${n === 1 ? '' : ` ${n}`}${NOTE_EXTENSION}`;
    const name = safeName(title, 'Untitled', MAX_NAME_BYTES - utf8Length(tail)) + tail;
    if (!used.has(nameKey(name))) return name;
  }
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
