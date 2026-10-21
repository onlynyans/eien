// What a crash can leave in a vault (spec §3), the same on every system: a
// hidden file beside a note for the moment of a write (its temp file) or a
// rename made in two steps. Each system's storage makes them; each recovers
// them when the vault opens.

import { extensionOf, fitBytes, MAX_NAME_BYTES, utf8Length } from '../core/paths';

/**
 * The end of a write's temp file's name: ".<note name>.<token>.eien.tmp".
 * The token is the write's own, so a save never takes the temp file another
 * write left: a crash's, or one Syncthing brought from another device, whose
 * words may be nowhere else. Before tokens it was ".<note name>.eien.tmp".
 */
export const TEMP_SUFFIX = '.eien.tmp';

/** A write's token: eight hex digits at the end of the note's name. */
const TOKEN_END = /\.[0-9a-f]{8}$/u;

/**
 * The end of a new file's temp name while its bytes go in (Storage.writeNew,
 * an imported image): ".<name>.eien-new". It holds nothing that isn't still
 * where it was copied from, so one a crash leaves is simply removed.
 */
export const NEW_SUFFIX = '.eien-new';

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

/** A token for one write: random, so no two devices or writes share a temp file. */
export function newToken(): string {
  const [value = 0] = crypto.getRandomValues(new Uint32Array(1));
  return value.toString(16).padStart(8, '0');
}

/** The temp file a write to `name` goes through: ".<name>.<token>.eien.tmp". */
export const tempBeside = (name: string, token = newToken()): string =>
  hiddenBeside(name, `.${token}${TEMP_SUFFIX}`);

/** The name a write's temp file was for (with its token or from before them), or null. */
export function tempFor(hidden: string): string | null {
  const named = besideOf(hidden, TEMP_SUFFIX);
  const name = named?.replace(TOKEN_END, '') ?? '';
  return name === '' ? null : name;
}

/** The name a step's hidden name stands for, or null when `name` isn't one. */
export const steppedFrom = (name: string): string | null =>
  besideOf(name, CASE_STEP) ?? besideOf(name, TRASH_STEP);

/**
 * Whether a temp file holds words its note doesn't: any but the note's own
 * (or none at all, a write cut before any words went in). Whatever their
 * times: a temp file is never saved over (each write takes one of its own),
 * so one a crash left, here or on another device, holds words that may be
 * nowhere else.
 */
export const strayHoldsWords = (temp: string, note: string | null): boolean =>
  temp.length > 0 && temp !== note;
