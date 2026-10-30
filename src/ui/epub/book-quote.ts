// The words chosen in a book, as a quote (#40, Phase 2c): read as a paste
// reads a page (core/html's fromHtml), so their marks are the words' own,
// with nothing of the page's (./book-words.ts), set as a Markdown quote with
// the book's title and the chapter's name under them (core/epub/quote.ts).

import { chapterTitle, type Epub, quoted } from '../../core/epub';
import { fromHtml } from '../../core/html';
import { markupOf, wordsIn } from './book-words';
import type { EpubPage } from './epub-page';

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

/** A book's page whose words are quoted, and where the quote goes. */
export interface QuoteFrom {
  readonly page: EpubPage;
  readonly epub: Epub | null;
  readonly spine: number;
  /** The quote put in the note beside: the note's name, or why not. */
  send(text: string): Promise<{ readonly into: string } | { readonly not: string }>;
  /** Whether the page has gone meanwhile. */
  gone(): boolean;
}

/**
 * The words chosen in the chapter now (or `kept`: last chosen there, a
 * phone's ⋯) quoted in the note beside, with where they came from; once: the
 * selection goes with it. What happened is said on the page, unless it gave
 * its place to the note (a phone's one page), which says it there.
 */
export async function quoteChosen(from: QuoteFrom, kept: boolean): Promise<void> {
  const { page } = from;
  const text = quoteOf(
    kept ? page.sheet.kept : page.sheet.selection,
    from.epub,
    from.spine,
    page.name,
  );
  if (!text) return page.foot.say('Choose some words in the book to quote.');
  const done = await from.send(text);
  if ('into' in done) document.getSelection()?.removeAllRanges();
  if (!from.gone()) page.foot.say('into' in done ? `Quoted in ${done.into}.` : done.not);
}
