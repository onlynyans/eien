// What a file or folder may be called, so a vault opens on every system it
// syncs to: macOS, Windows, Linux, Android and iOS (spec §3, Paths).

/** Windows refuses these as names, with or without an extension, in any case. */
const RESERVED_WORD = '(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])';
const RESERVED = new RegExp(`^${RESERVED_WORD}(\\..*)?$`, 'i');

/** Characters some system can't store in a name, and control characters. */
// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this refuses
const FORBIDDEN = /[<>:"/\\|?*\u0000-\u001f\u007f]/;

/** Most file systems cap a name at 255 bytes of UTF-8. */
export const MAX_NAME_BYTES = 255;

/**
 * The longest name Eien makes: room is left for the 10 bytes a save's temp
 * file adds (".<name>.eien.tmp"), so a note Eien named can always be saved.
 */
export const MAX_MADE_NAME_BYTES = MAX_NAME_BYTES - 10;

export type NameProblem =
  | 'empty'
  | 'dot-name'
  | 'forbidden-character'
  | 'reserved'
  | 'trailing-dot-or-space'
  | 'leading-space'
  | 'too-long';

/** Every reason `name` can't be used, or none. */
export function nameProblems(name: string): NameProblem[] {
  if (name.length === 0) return ['empty'];
  if (name === '.' || name === '..') return ['dot-name'];
  const problems: NameProblem[] = [];
  // A lone half of a surrogate pair: the disk stores it as U+FFFD, under another name.
  if (FORBIDDEN.test(name) || !name.isWellFormed()) problems.push('forbidden-character');
  if (RESERVED.test(name)) problems.push('reserved');
  if (/[. ]$/.test(name)) problems.push('trailing-dot-or-space');
  if (name.startsWith(' ')) problems.push('leading-space');
  if (utf8Length(name) > MAX_NAME_BYTES) problems.push('too-long');
  return problems;
}

export const isValidName = (name: string): boolean => nameProblems(name).length === 0;

/** Names Eien keeps to itself or never shows: dot-files and dot-folders. */
export const isHiddenName = (name: string): boolean => name.startsWith('.');

/** The vault's own settings (spec §6): in the hidden .eien folder, but watched. */
export const VAULT_CONFIG = '.eien/config.json';

/** The vault's pinned notes, beside its settings, and watched as they are. */
export const VAULT_PINS = '.eien/pinned.json';

/** A folder's own settings (spec §2): its order, and whether it's a book. Watched, beside its notes. */
export const FOLDER_SETTINGS_NAME = '.eien-folder.json';

/**
 * A change a watcher reports: nothing hidden (temp files, dot-files, .eien)
 * but the vault's settings and pins, and a folder's settings.
 */
export function isWatchedPath(path: string): boolean {
  if (path === VAULT_CONFIG || path === VAULT_PINS) return true;
  const parts = path.split('/');
  const last = parts.length - 1;
  return parts.every(
    (name, i) => !isHiddenName(name) || (i === last && name === FOLDER_SETTINGS_NAME),
  );
}

/**
 * Two names that one system would treat as the same file. macOS and Windows
 * ignore case, folded fully as macOS does ("Straße" is "STRASSE", "ſ" is
 * "s", a final "ς" is "σ"); all of them ignore Unicode normalisation.
 */
export const nameKey = (name: string): string =>
  name.normalize('NFC').toUpperCase().toLowerCase().normalize('NFC');

/**
 * A name made from what the writer typed: forbidden characters (and a lone
 * half of a surrogate pair) become spaces, runs of space collapse, the ends
 * are trimmed of dots and spaces, a reserved name gets a trailing "-", and
 * it's cut to `maxBytes` (whole characters only). Empty input gives
 * `fallback`.
 */
export function safeName(
  typed: string,
  fallback = 'Untitled',
  maxBytes = MAX_MADE_NAME_BYTES,
): string {
  let name = typed
    .normalize('NFC')
    .replace(new RegExp(FORBIDDEN.source, 'g'), ' ')
    .replace(/\p{Surrogate}/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '');
  const cut = (text: string) => fitBytes(text, maxBytes).replace(/[. ]+$/, '');
  name = cut(name);
  // "con.txt" → "con-.txt": the "-" right after the reserved word, where neither an
  // extension nor cutting to length can undo it. Checked after the cut, which can
  // leave one ("con …" cut to "con").
  if (RESERVED.test(name)) name = cut(name.replace(new RegExp(`^${RESERVED_WORD}`, 'i'), '$1-'));
  return name.length > 0 ? name : fallback;
}

/** Bytes `text` takes in UTF-8. */
export function utf8Length(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/** `text` cut to at most `max` bytes of UTF-8, never inside a character. */
export function fitBytes(text: string, max: number): string {
  let out = '';
  let bytes = 0;
  for (const char of text) {
    const size = utf8Length(char);
    if (bytes + size > max) break;
    out += char;
    bytes += size;
  }
  return out;
}
