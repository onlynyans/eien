import { describe, expect, it } from 'vitest';
import type { Epub } from '../../core/epub';
import { headOf } from './book-open';

const book = (title: string, author: string) => ({ title, author }) as Epub;

describe('a book’s head (#57)', () => {
  it('names the book: its title and author, the title alone with no author', () => {
    expect(headOf(book('Emma', 'Jane Austen'), 'Novels/Emma.epub')).toBe('Emma · Jane Austen');
    expect(headOf(book('Emma', ''), 'Novels/Emma.epub')).toBe('Emma');
  });

  it('takes its file’s name with no title of its own, and while it’s read', () => {
    expect(headOf(book('', 'Jane Austen'), 'Novels/Emma.epub')).toBe('Emma · Jane Austen');
    expect(headOf(null, 'Novels/Emma.epub')).toBe('Emma');
  });
});
