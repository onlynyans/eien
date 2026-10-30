// A passage quoted from a book into a note (#40, Phase 2c): the book's words
// as Markdown (read as a paste is, so their marks are the words' own), each
// line set in a Markdown quote, and where they came from under them: the
// book's title and the chapter, with no author, as decided. It goes at the
// note's end, after a blank line: the note's own words are never touched.

import { escapeHtml, fromHtml } from '../html';

/** Where a quote came from: the book's title, and its chapter's name where the contents give one. */
export interface QuoteSource {
  readonly title: string;
  readonly chapter: string | null;
}

/**
 * The citation under a quote: "— Pride and Prejudice, Chapter III", its words
 * the book's own: a mark in a title (*, _, [) is escaped, as the passage's are.
 */
export const citation = ({ title, chapter }: QuoteSource): string => {
  const words = [title.trim(), chapter?.trim()].filter(Boolean).join(', ');
  return `— ${fromHtml(`<p>${escapeHtml(words)}</p>`)}`;
};

/** `markdown` (the book's words) as a Markdown quote with its citation; '' for no words. */
export function quoted(markdown: string, source: QuoteSource): string {
  const lines = markdown.replace(/\r\n?/gu, '\n').trim().split('\n');
  if (lines.join('').trim() === '') return '';
  return [...lines, '', citation(source)]
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n');
}

/** A note's `text` with `quote` at its end, a blank line before it and a line end after. */
export function withQuote(text: string, quote: string): string {
  const kept = text.replace(/\s+$/u, '');
  return `${kept}${kept === '' ? '' : '\n\n'}${quote}\n`;
}
