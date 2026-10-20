// Where a link or image in a note points, as a vault path: relative to the
// note's folder ("cover.png", "../art/cover.png"), or to the vault itself
// ("/attachments/cover.png"). Never outside the vault.

import { vaultPath } from './vault-path';

/**
 * The vault path `ref` names from a note in `folder`, or null when it leaves
 * the vault, is a web address, or isn't a valid path. Percent-escapes
 * ("my%20cover.png") are read; a "#fragment" or "?query" is ignored.
 */
export function resolveLinkPath(folder: string, ref: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) return null; // a web address, mailto:, data:…
  let path: string;
  try {
    path = decodeURIComponent(ref.replace(/[?#].*$/, '').replace(/^<|>$/g, ''));
  } catch {
    return null; // a stray "%"
  }
  if (!path) return null;
  const parts = path.startsWith('/') ? [] : folder.split('/').filter(Boolean);
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length === 0) return null; // climbs out of the vault
      parts.pop();
    } else parts.push(part);
  }
  try {
    const resolved = vaultPath(parts.join('/'));
    return resolved || null;
  } catch {
    return null;
  }
}
