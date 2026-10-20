// Tags (spec §2): in front matter (`tags:`), or inline as #tag, nested with
// a slash (#fic/aot). Not tags: a "#" in code, links or addresses, a
// heading's "#", an escaped \#, or "#" and digits only (#1).

import { parse } from 'yaml';

/**
 * An inline tag: "#" at the start or after a space, then letters, digits,
 * "_", "-" and "/". Accents may be separate marks (\p{M}), as in text
 * typed on some systems.
 */
const INLINE = /(?<=^|\s)#([\p{L}\p{M}\p{N}_-][\p{L}\p{M}\p{N}_\-/]*)/gu;
const WHOLE = /^[\p{L}\p{M}\p{N}_-][\p{L}\p{M}\p{N}_\-/]*$/u;
const LETTER = /\p{L}/u;

/** A tag as written, tidied ("fic//aot/" → "fic/aot"); null when it isn't one. */
export function tidyTag(raw: string): string | null {
  const body = raw.normalize('NFC').replace(/^#/, '');
  if (!WHOLE.test(body)) return null;
  const tag = body.split('/').filter(Boolean).join('/');
  return LETTER.test(tag) ? tag : null;
}

/**
 * Two tags are the same tag whatever their case: #Draft is #draft, folded
 * fully (#Straße is #STRASSE) and with the dotted capital I (#İstanbul is
 * #istanbul).
 */
export const tagKey = (tag: string): string =>
  tag
    .normalize('NFC')
    .toUpperCase()
    .toLowerCase()
    .replace(/i\u0307/g, 'i')
    .normalize('NFC');

/** The inline tags in `taggable` text (see core/markdown: code and links already blanked). */
export function inlineTags(taggable: string): string[] {
  const found: string[] = [];
  for (const match of taggable.matchAll(INLINE)) {
    const tag = tidyTag(match[1] ?? '');
    if (tag) found.push(tag);
  }
  return found;
}

/**
 * The tags in a front matter block (its YAML, without the "---" lines):
 * `tags: [a, b]`, a list, or `tags: a, b`. Broken YAML has none.
 */
export function frontMatterTags(yaml: string): string[] {
  let data: unknown;
  try {
    data = parse(yaml, { uniqueKeys: false });
  } catch {
    return [];
  }
  if (typeof data !== 'object' || data === null || !('tags' in data)) return [];
  const value = (data as { tags: unknown }).tags;
  const items = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\s]+/)
      : [];
  return items.flatMap((item) => {
    const tag = typeof item === 'string' ? tidyTag(item.trim()) : null;
    return tag ? [tag] : [];
  });
}

/** Tags without repeats, case aside; the first spelling stays. */
export function uniqueTags(tags: Iterable<string>): string[] {
  const seen = new Map<string, string>();
  for (const tag of tags) if (!seen.has(tagKey(tag))) seen.set(tagKey(tag), tag);
  return [...seen.values()];
}
