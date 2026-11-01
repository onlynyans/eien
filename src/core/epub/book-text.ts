// A chapter's words as Find reads them (#40, Phase 5c): its blocks (a
// paragraph, a heading, a cell), each its text as it reads and where it
// begins in the chapter's words, by the one walk the place and the page
// count take (./chapter-words.ts), so a match's offsets are the place's.
// A blank piece reads in a block's text (the space between two words in
// two elements) but has no offset, as a place never counts it; a line break
// (a verse's, a letter's) ends a run of text as a block does, so a search
// never runs across it.

import type { CleanElement, CleanNode } from '../html';
import { walkChapter } from './chapter-words';

/** A run of a block's text the chapter's words don't count: where it begins in the text, and how long. */
export interface Gap {
  readonly at: number;
  readonly length: number;
}

export interface BookBlock {
  /** Its words as they read. */
  readonly text: string;
  /** Where its first counted character is in the chapter's words. */
  readonly from: number;
  /** What its text holds that the chapter's words don't, in order. */
  readonly gaps: readonly Gap[];
}

/** The chapter `nodes` hold, as its blocks. */
export function chapterBlocks(nodes: readonly CleanNode[]): BookBlock[] {
  const drafts: { block: CleanElement | null; text: string; from: number; gaps: Gap[] }[] = [];
  let counted = 0;
  /** Whether a line break ended the last run of text. */
  let broken = false;
  /** The run `block`'s text goes on in: the last, if it's that block's and no break ended it, else a new one. */
  const into = (block: CleanElement | null) => {
    const last = drafts.at(-1);
    if (last && last.block === block && !broken) return last;
    broken = false;
    const made = { block, text: '', from: counted, gaps: [] };
    drafts.push(made);
    return made;
  };
  walkChapter(nodes, {
    text(text, isCounted, block) {
      const now = into(block);
      if (!isCounted) now.gaps.push({ at: now.text.length, length: text.length });
      now.text += text;
      if (isCounted) counted += text.length;
    },
    lineBreak() {
      broken = true;
    },
  });
  return drafts
    .filter((draft) => draft.text.trim() !== '')
    .map(({ text, from, gaps }) => ({ text, from, gaps }));
}

/**
 * The offset in the chapter's words of `index` in `block`'s text: its own
 * offset less what the gaps before it hold; an index inside a gap stands at
 * the counted character after it.
 */
export function offsetIn(block: BookBlock, index: number): number {
  let uncounted = 0;
  for (const gap of block.gaps) {
    if (gap.at >= index) break;
    uncounted += Math.min(gap.length, index - gap.at);
  }
  return block.from + index - uncounted;
}
