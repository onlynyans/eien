import { describe, expect, it } from 'vitest';
import { bookHref, bookLinkOf } from './book-link';

describe('a link inside a book', () => {
  it('is an address of the page’s own, its parts escaped', () => {
    expect(bookHref({ path: 'OEBPS/text/notes.xhtml', fragment: 'fn 1' })).toBe(
      '#book/OEBPS%2Ftext%2Fnotes.xhtml:fn%201',
    );
    expect(bookHref({ path: 'settings', fragment: '' })).toBe('#book/settings');
  });

  it('reads back only a book’s own address, to a clean path in the zip', () => {
    for (const href of [
      '#fn1',
      'book/a.xhtml',
      '#book/',
      '#book/..%2Fa.xhtml',
      '#book/%2Fetc%2Fpasswd',
      '#book/a.xhtml:b:c',
      '#book/%E0%A4%A',
      '#book/a.xhtml:%',
      '#book/folder%2F',
      'javascript:alert(1)',
    ]) {
      expect(bookLinkOf(href), href).toBeNull();
    }
  });
});
