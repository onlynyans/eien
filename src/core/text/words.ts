// Words in a note, as a writer counts them: the language's own word breaks
// (so "don't" is one word, and Chinese or Japanese are counted per word, not
// per space), punctuation and Markdown marks not counted, front matter left
// out.

import { frontMatterEnd } from './front-matter';

const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });

/** Words in `text` (editor text), front matter excluded. */
export function countWords(text: string): number {
  let count = 0;
  for (const segment of segmenter.segment(text.slice(frontMatterEnd(text)))) {
    if (segment.isWordLike) count++;
  }
  return count;
}
