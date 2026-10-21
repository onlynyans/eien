// The sidebar's Tags: each tag once, nested by "/", with how many notes
// carry it or a tag under it.

import { byName } from '../vault/tree';
import { tagKey } from './tags';

export interface TagNode {
  /** The last part, as shown: "aot" for #fic/aot. */
  readonly name: string;
  /** The whole tag, as first written: "fic/aot". */
  readonly tag: string;
  /** The whole tag, case aside: what notes are matched by. */
  readonly key: string;
  /** Notes carrying this tag, or one under it. */
  readonly count: number;
  readonly children: readonly TagNode[];
}

interface Building {
  name: string;
  tag: string;
  key: string;
  notes: Set<string>;
  children: Map<string, Building>;
}

/**
 * The tag tree for these notes, and the tags `made` with no notes yet (./made.ts),
 * counted 0. Spellings come from the first note by path, then the made tag's.
 */
export function buildTagTree(
  notes: Iterable<{ readonly path: string; readonly tags: readonly string[] }>,
  made: readonly string[] = [],
): TagNode[] {
  const roots = new Map<string, Building>();
  const sorted = [...notes].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  // A made tag is a note of no path: it adds its tag, and no count.
  const all = [...sorted, ...(made.length > 0 ? [{ path: '', tags: made }] : [])];
  for (const note of all) {
    for (const tag of note.tags) {
      let level = roots;
      const parts = tag.split('/');
      parts.forEach((name, i) => {
        const whole = parts.slice(0, i + 1).join('/');
        const key = tagKey(whole);
        let node = level.get(key);
        if (!node) {
          node = { name, tag: whole, key, notes: new Set(), children: new Map() };
          level.set(key, node);
        }
        if (note.path) node.notes.add(note.path);
        level = node.children;
      });
    }
  }
  const finish = (level: Map<string, Building>): TagNode[] =>
    [...level.values()]
      .sort((a, b) => byName(a.name, b.name))
      .map((node) => ({
        name: node.name,
        tag: node.tag,
        key: node.key,
        count: node.notes.size,
        children: finish(node.children),
      }));
  return finish(roots);
}

/** Whether `tags` carry the tag `key`, or one under it. */
export function hasTag(tags: readonly string[], key: string): boolean {
  return tags.some((tag) => {
    const own = tagKey(tag);
    return own === key || own.startsWith(`${key}/`);
  });
}
