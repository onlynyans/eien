// A note's tags in two kinds (spec §2): those in its front matter, which the
// page adds and takes off, and those typed in the text, which stay where the
// writer put them. The index lists both as one; the page tells them apart.

import { readMarkdown } from '../markdown';
import { frontMatterTags, inlineTags, tagKey, uniqueTags } from '../tags';
import { frontMatterBlock } from '../text';

export interface NoteTags {
  /** In front matter (`tags:`), each once (case aside), as first written. */
  readonly front: readonly string[];
  /** Typed in the text and not in front matter too, each once. */
  readonly inline: readonly string[];
}

/** The two kinds from a front matter's YAML and the body's taggable text (core/markdown). */
export function tagsFrom(yaml: string, taggable: string): NoteTags {
  const front = uniqueTags(frontMatterTags(yaml));
  const inFront = new Set(front.map(tagKey));
  return {
    front,
    inline: uniqueTags(inlineTags(taggable)).filter((tag) => !inFront.has(tagKey(tag))),
  };
}

/** The tags of `text`, as the editor holds it. */
export function noteTags(text: string): NoteTags {
  const front = frontMatterBlock(text);
  return tagsFrom(front?.yaml ?? '', readMarkdown(text.slice(front?.end ?? 0)).taggable);
}
