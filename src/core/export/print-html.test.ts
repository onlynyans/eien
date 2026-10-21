import { describe, expect, it } from 'vitest';
import type { ExportRequest } from './book';
import { printHtml } from './print-html';

const BOOK: ExportRequest = {
  title: 'A <Mended> Scarf',
  notes: [
    { title: 'One', markdown: 'A[^1].\n\n[^1]: Note.' },
    { title: 'Two', markdown: 'B[^1].\n\n[^1]: Other.' },
  ],
  book: true,
  quotes: 'curly',
  language: 'en-US',
  key: 'k',
  date: new Date(0),
};

describe('printHtml', () => {
  const html = printHtml(BOOK);

  it('runs nothing and loads nothing', () => {
    expect(html).toContain(
      `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`,
    );
    expect(html).not.toMatch(/<script|<img|<link|url\(/iu);
  });

  it('has a title page for a book, then each chapter in its own section', () => {
    expect(html).toContain('<title>A &lt;Mended&gt; Scarf</title>');
    expect(html).toContain('<section class="title-page"><h1>A &lt;Mended&gt; Scarf</h1></section>');
    expect(html.match(/<section class="chapter">/gu)).toHaveLength(2);
    expect(html).not.toContain('title-page"><h1>One');
    expect(printHtml({ ...BOOK, book: false })).not.toContain('class="title-page"');
  });

  it('gives each chapter’s footnotes their own ids', () => {
    expect(html).toContain('href="#c1-fn1"');
    expect(html).toContain(
      '<div class="note" id="c2-fn1">\n<p><a href="#c2-fnref1">1.</a> Other.</p>',
    );
  });

  it('says its language', () => {
    expect(html).toContain('<html lang="en-US">');
  });
});
