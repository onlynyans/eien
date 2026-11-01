// Paths inside a book's zip (#40). An entry's name is checked before
// anything is read, and every address a book's files give (the package's
// manifest, a chapter's picture) is resolved within the zip: nothing a book
// names ever reaches outside it, nor anything but its own entries.

import { parentOf } from '../paths';

/** A part of a name that isn't a clean one: "." or "..", a backslash, a control character. */
const unsafePart = (part: string): boolean =>
  part === '' ||
  part === '.' ||
  part === '..' ||
  [...part].some((char) => char === '\\' || char < ' ' || char === '\u007f');

/**
 * Whether `name` is a clean path inside the zip: relative, "/" between its
 * parts, none empty, "." or "..", no backslash, control character or drive
 * letter. A folder's own entry ends in "/".
 */
export function isZipPath(name: string): boolean {
  if (name === '' || name.startsWith('/') || /^[a-z]:/iu.test(name)) return false;
  const parts = (name.endsWith('/') ? name.slice(0, -1) : name).split('/');
  return !parts.some(unsafePart);
}

/** An address in a book, apart: its path in the zip, and the place within that file. */
export interface ZipAddress {
  readonly path: string;
  /** After the "#", decoded; '' for none. */
  readonly fragment: string;
}

const decoded = (text: string): string | null => {
  try {
    return decodeURIComponent(text);
  } catch {
    return null; // a stray "%"
  }
};

/**
 * The entry `href` names from the file at `from` (both in the zip), or null:
 * a web address or any scheme, an address climbing above the zip's root, or
 * one that isn't a clean path. Percent-escapes are read; a query is dropped.
 * An href of only "#id" is `from` itself.
 */
export function inZip(from: string, href: string): ZipAddress | null {
  const trimmed = href.trim();
  if (/^[a-z][a-z0-9+.-]*:/iu.test(trimmed) || trimmed.startsWith('//')) return null;
  const hash = trimmed.indexOf('#');
  const fragment = decoded(hash < 0 ? '' : trimmed.slice(hash + 1));
  const ref = decoded((hash < 0 ? trimmed : trimmed.slice(0, hash)).replace(/\?.*$/u, ''));
  if (fragment === null || ref === null) return null;
  if (ref === '') return isZipPath(from) ? { path: from, fragment } : null;
  const parts = ref.startsWith('/') ? [] : parentOf(from).split('/').filter(Boolean);
  for (const part of ref.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return null; // above the zip's root
      parts.pop();
    } else parts.push(part);
  }
  const path = parts.join('/');
  return isZipPath(path) ? { path, fragment } : null;
}
