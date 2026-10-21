// What the page's tag field offers (docs/design/explorations/tags.md): the
// vault's tags with their counts, leaving out those the note has, then
// "Make #…" for a tag no note has yet.

import { tagKey, tidyTag } from './tags';
import type { TagNode } from './tree';

export interface TagChoice {
  /** The whole tag, as first written: "fic/aot". */
  readonly tag: string;
  /** Notes carrying it (or a tag under it); 0 for one made new. */
  readonly count: number;
  /** A tag no note has yet, made by choosing it. */
  readonly made?: true;
}

/** How many of the vault's tags the field lists at once. */
export const CHOICES_SHOWN = 8;

/**
 * The tags offered for `typed` (a "#" before it or not) to a note that has
 * `has`: the vault's, from `tree`, whose name holds what's typed, those that
 * start with it first, each list in the tree's order; then "Make #…" when
 * what's typed is a tag that isn't there.
 */
export function tagChoices(
  tree: readonly TagNode[],
  has: readonly string[],
  typed: string,
): TagChoice[] {
  const query = tagKey(typed.trim().replace(/^#/, ''));
  const had = new Set(has.map(tagKey));
  const all: TagNode[] = [];
  const walk = (nodes: readonly TagNode[]) => {
    for (const node of nodes) {
      all.push(node);
      walk(node.children);
    }
  };
  walk(tree);
  const open = all.filter((node) => !had.has(node.key) && node.key.includes(query));
  const starting = open.filter((node) => node.key.startsWith(query));
  const rest = open.filter((node) => !node.key.startsWith(query));
  const found: TagChoice[] = [...starting, ...rest]
    .slice(0, CHOICES_SHOWN)
    .map((node) => ({ tag: node.tag, count: node.count }));
  const made = tidyTag(typed.trim());
  const known =
    made !== null && (had.has(tagKey(made)) || all.some((node) => node.key === tagKey(made)));
  return made && !known ? [...found, { tag: made, count: 0, made: true }] : found;
}
