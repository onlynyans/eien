// The words chosen in a book, as a quote (#40, Phase 2c): read as a paste
// reads a page (core/html's fromHtml), so their marks are the words' own,
// with nothing of the page's (./book-words.ts), set as a Markdown quote with
// the book's title and the chapter's name under them (core/epub/quote.ts).

import { chapterTitle, type Epub, quoted } from '../../core/epub';
import { fromHtml } from '../../core/html';
import { markupOf, wordsIn } from './book-words';

/** `range` in the spine item `spine` of `epub` (called `name` on the shelf) as a quote; '' for no words. */
export function quoteOf(
  range: Range | null,
  epub: Epub | null,
  spine: number,
  name: string,
): string {
  if (!range || !epub) return '';
  return quoted(fromHtml(markupOf(wordsIn(range))), {
    title: epub.title || name,
    chapter: chapterTitle(epub.contents, spine),
  });
}
