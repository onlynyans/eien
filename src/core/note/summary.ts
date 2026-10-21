// What the note list and the sidebar know of a note without opening it:
// a line of preview, its words and its tags (spec §2, §4).

import { readMarkdown } from '../markdown';
import { countPlainWords, firstGraphemes, frontMatterBlock, toEditor } from '../text';
import { noteIdOf } from '../versions';
import { tagsFrom } from './note-tags';

export interface NoteSummary {
  /** The first words, marks taken out; "" for an empty note. */
  readonly preview: string;
  readonly words: number;
  /** As first written, each once (case aside). */
  readonly tags: readonly string[];
  /** The id its versions are kept under (spec §2), once it's been sealed; else null. */
  readonly id: string | null;
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
  const front = frontMatterBlock(text);
  const end = front?.end ?? 0;
  const { plain, taggable } = readMarkdown(text.slice(end));
  const tags = tagsFrom(front?.yaml ?? '', taggable);
  return {
    preview: previewOf(plain, title),
    words: countPlainWords(plain),
    tags: [...tags.front, ...tags.inline],
    id: end > 0 ? noteIdOf(text.slice(0, end)) : null,
    plain,
  };
}

/** The first words, after a first line that only repeats the title. */
function previewOf(plain: string, title: string): string {
  // Only the start is needed: lines are taken until there's enough of them.
  const lines: string[] = [];
  let length = 0;
  let titleLine = title.trim().toLocaleLowerCase();
  for (const raw of plain.split('\n', 4 * PREVIEW_LENGTH)) {
    const line = raw.trim();
    if (!line) continue;
    if (lines.length === 0 && line.toLocaleLowerCase() === titleLine) {
      titleLine = ''; // the title's own line, skipped once
      continue;
    }
    lines.push(line);
    length += line.length + 1;
    if (length > 4 * PREVIEW_LENGTH) break;
  }
  // Cut between whole characters: an emoji made of several code points stays whole.
  return firstGraphemes(lines.join(' ').replace(/\s+/g, ' '), PREVIEW_LENGTH).trimEnd();
}
