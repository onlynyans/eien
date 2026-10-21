// What a crash can leave in a vault (spec §3), the same on every system: a
// hidden file beside a note for the moment of a write (its temp file) or a
// rename made in two steps. Each system's storage makes them; each recovers
// them when the vault opens.

import { extensionOf, fitBytes, MAX_NAME_BYTES, utf8Length } from '../core/paths';

/** The end of a write's temp file's name: ".<note name>.eien.tmp". */
export const TEMP_SUFFIX = '.eien.tmp';

/**
 * The ends of the hidden names the phone gives a file or folder between the
 * two steps of a case-only rename, and while what holds the trash steps
 * aside: ".<name>.eien-case", ".<name>.eien-trashing". They last a moment; a
 * crash between the steps leaves one, which Syncthing may bring to another
 * device. Whichever device opens the vault next puts it back.
 */
export const CASE_STEP = '.eien-case';
export const TRASH_STEP = '.eien-trashing';

/** A short hash of a name (FNV-1a), so two long names cut alike never share a hidden name. */
function shortHash(text: string): string {
  let hash = 0x811c9dc5;
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * The hidden name a file takes beside itself for a moment: ".<name><suffix>".
 * A name too long for the system's limit is cut, keeping its extension, with
 * a hash of the whole name so two cut alike differ: what a crash leaves is
 * recovered under the cut name, and a note's words still come back as a note.
 */
export function hiddenBeside(name: string, suffix: string): string {
  const whole = `.${name}${suffix}`;
  if (utf8Length(whole) <= MAX_NAME_BYTES) return whole;
  const extension = extensionOf(name);
  const tail = `~${shortHash(name)}${extension}${suffix}`;
  const base = name.slice(0, name.length - extension.length);
  return `.${fitBytes(base, MAX_NAME_BYTES - 1 - utf8Length(tail))}${tail}`;
}

/** The name a hidden one made by hiddenBeside stands for, or null when it isn't one with `suffix`. */
export function besideOf(hidden: string, suffix: string): string | null {
  if (!hidden.startsWith('.') || !hidden.endsWith(suffix)) return null;
  return hidden.length > suffix.length + 1 ? hidden.slice(1, -suffix.length) : null;
}

/** The name a step's hidden name stands for, or null when `name` isn't one. */
export const steppedFrom = (name: string): string | null =>
  besideOf(name, CASE_STEP) ?? besideOf(name, TRASH_STEP);

/**
 * Whether a temp file holds words its note doesn't: any but the note's own
 * (or none at all, a write cut before any words went in). Whatever their
 * times: a temp file a crash left is never one this device saved over since
 * (its next save of the note takes the same temp file), so a note newer than
 * it was changed elsewhere, and the temp's words are nowhere else.
 */
export const strayHoldsWords = (temp: string, note: string | null): boolean =>
  temp.length > 0 && temp !== note;
