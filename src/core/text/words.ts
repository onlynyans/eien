// Words in a note, as a writer counts them: the language's own word breaks
// (so "don't" is one word, and Chinese or Japanese are counted per word, not
// per space), the words only — no Markdown marks, link addresses, HTML tags
// or front matter.

import { readMarkdown } from '../markdown';
import { frontMatterEnd } from './front-matter';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });

/** Words in `text` (editor text): front matter, marks, addresses and tags left out. */
export function countWords(text: string): number {
  return countPlainWords(readMarkdown(text.slice(frontMatterEnd(text))).plain);
}

/** Words in text that's already plain (see core/markdown). */
export function countPlainWords(plain: string): number {
  let count = 0;
  for (const segment of segmenter.segment(plain)) {
    if (segment.isWordLike) count++;
  }
  return count;
}
