// What the note list and the sidebar know of a note without opening it:
// a line of preview, its words and its tags (spec §2, §4).

import { readMarkdown } from '../markdown';
import { frontMatterTags, inlineTags, uniqueTags } from '../tags';
import { countWords, frontMatterEnd, toEditor } from '../text';

export interface NoteSummary {
  /** The first words, marks taken out; "" for an empty note. */
  readonly preview: string;
  readonly words: number;
  /** As first written, each once (case aside). */
  readonly tags: readonly string[];
}

/** A note as the window lists it, without opening it. */
export interface IndexedNote extends NoteSummary {
  readonly path: string;
  /** Last modified, in milliseconds since 1970. */
  readonly modified: number;
}

export interface ReadNote extends NoteSummary {
  /** The note's words, for search. */
  readonly plain: string;
}

/** How much of the start a preview keeps; the list cuts it to its width. */
export const PREVIEW_LENGTH = 160;

/** Read a note's file contents (any line endings, a byte-order mark or not) titled `title`. */
export function readNote(raw: string, title: string): ReadNote {
  const text = toEditor(raw);
  const end = frontMatterEnd(text);
  // The YAML between the "---" lines: from after the first to before the closing one.
  const yaml = end > 0 ? text.slice(4, end).replace(/(?:^|\n)(?:---|\.\.\.)[ \t]*\n?$/, '') : '';
  const { plain, taggable } = readMarkdown(text.slice(end));
  return {
    preview: previewOf(plain, title),
    words: countWords(text),
    tags: uniqueTags([...frontMatterTags(yaml), ...inlineTags(taggable)]),
    plain,
  };
}

/** The first words, after a first line that only repeats the title. */
function previewOf(plain: string, title: string): string {
  const lines = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines[0]?.toLocaleLowerCase() === title.trim().toLocaleLowerCase()) lines.shift();
  const preview = [...lines.join(' ').replace(/\s+/g, ' ')]; // by code point: an emoji stays whole
  return preview.length > PREVIEW_LENGTH
    ? preview.slice(0, PREVIEW_LENGTH).join('').trimEnd()
    : preview.join('');
}
