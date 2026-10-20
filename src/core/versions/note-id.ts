// A note's id (spec §2): given the first time the note is sealed and kept
// in its front matter, so its versions follow it through renames and moves.
// The front matter is changed by a line, never rewritten: other keys, their
// comments and their formatting stay byte for byte.

import { parse } from 'yaml';
import { frontMatterEnd } from '../text';

/** Crockford's base 32: no I, L, O or U, so an id reads back as written. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * An id's first character is a letter, so YAML reads every id as text: all
 * digits ("0000000000") would read as a number, and digits around an E
 * ("12E4567890") as a float. Sixteen of them, so a byte's low four bits
 * choose evenly.
 */
const FIRST = 'ABCDEFGHJKMNPQRS';

/** Ten characters: 49 random bits, plenty for one writer's notes. */
export const NOTE_ID_LENGTH = 10;

/**
 * What can be used as a folder's name under .eien/versions: letters, digits,
 * "-" and "_". An id another tool wrote (a UUID, a number) is used as it is;
 * anything else (a "/", "..") never is.
 */
const USABLE = /^[A-Za-z0-9_-]{1,64}$/;

/** A new id from `random`, which gives NOTE_ID_LENGTH random bytes. */
export function newNoteId(random: Uint8Array): string {
  if (random.length < NOTE_ID_LENGTH) throw new RangeError('Not enough random bytes.');
  // 256 is a multiple of 32 (and 16), so each byte's low bits are evenly random.
  return Array.from(random.subarray(0, NOTE_ID_LENGTH), (byte, i) =>
    i === 0 ? FIRST[byte & 15] : ALPHABET[byte & 31],
  ).join('');
}

/** Whether `id` can name a note's versions folder. */
export const isUsableNoteId = (id: string): boolean => USABLE.test(id);

/** The front matter's YAML, and where the text after it starts; null when there's none. */
function frontMatterOf(text: string): { readonly yaml: string; readonly end: number } | null {
  const end = frontMatterEnd(text);
  if (end === 0) return null;
  const yaml = text.slice(4, end).replace(/(?:^|\n)(?:---|\.\.\.)[ \t]*\n?$/, '');
  return { yaml, end };
}

/** The front matter as data: a map (possibly empty), or undefined when it's anything else or broken. */
function frontMatterData(yaml: string): Record<string, unknown> | undefined {
  let data: unknown;
  try {
    data = parse(yaml, { uniqueKeys: false });
  } catch {
    return undefined;
  }
  if (data === null || data === undefined) return {};
  return typeof data === 'object' && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
}

/**
 * The id written in a note's front matter (`text` as the editor holds it),
 * when there's one Eien can use; null for none. An unusable one is "taken"
 * (see `withNoteId`).
 */
export function noteIdOf(text: string): string | null {
  const front = frontMatterOf(text);
  const value = front ? frontMatterData(front.yaml)?.id : undefined;
  const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
  return typeof id === 'string' && isUsableNoteId(id) ? id : null;
}

/**
 * Whether the front matter holds an id Eien can't use and mustn't write over:
 * another tool's ("a/b", a list). An empty one (`id:`, `id: null`, a
 * template's) isn't anyone's, and can be filled in.
 */
export function hasForeignNoteId(text: string): boolean {
  const front = frontMatterOf(text);
  const data = front ? frontMatterData(front.yaml) : undefined;
  if (!data || !('id' in data)) return false;
  const value = data.id;
  return value !== null && value !== undefined && value !== '' && noteIdOf(text) === null;
}

/** A top-level `id:` line, its value and any comment after it. */
const ID_LINE = /^id[ \t]*:[ \t]*(?:"[^"\n]*"|'[^'\n]*'|[^#\n]*?)([ \t]+#[^\n]*)?[ \t]*$/m;

/**
 * `text` with `id` in its front matter: added as the first key, or put in
 * place of the one there. Null when it can't be done without rewriting what
 * the writer wrote: front matter that isn't a map of keys (a list, broken
 * YAML), or an id written in some other shape.
 */
export function withNoteId(text: string, id: string): string | null {
  if (!isUsableNoteId(id)) return null;
  const front = frontMatterOf(text);
  if (!front) return `---\nid: ${id}\n---\n${text}`;
  const data = frontMatterData(front.yaml);
  if (!data) return null;
  let yaml: string;
  if (!('id' in data)) yaml = `id: ${id}\n${front.yaml}`;
  else {
    const line = ID_LINE.exec(front.yaml);
    if (!line) return null;
    yaml = `${front.yaml.slice(0, line.index)}id: ${id}${line[1] ?? ''}${front.yaml.slice(line.index + line[0].length)}`;
  }
  // The closing line, and what follows it, as they were.
  const closing = text.slice(4 + front.yaml.length, front.end);
  const next = `---\n${yaml}${closing}${text.slice(front.end)}`;
  // Checked by reading it back: a key that only looked like a line ("id: |" and the lines
  // under it) is refused rather than half-changed.
  return noteIdOf(next) === id ? next : null;
}
