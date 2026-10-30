import { describe, expect, it } from 'vitest';
import { chapterBeside, chapterTitle } from './chapters';

const spine = [
  { path: 'title.xhtml', linear: true },
  { path: 'one.xhtml', linear: true },
  { path: 'note.xhtml', linear: false },
  { path: 'two.xhtml', linear: true },
];
const row = (title: string, at: number) => ({ title, path: '', fragment: '', depth: 0, spine: at });

describe('a book’s chapters', () => {
  it('are called by their first row in the contents', () => {
    const contents = [row('Chapter I', 1), row('A part of it', 1), row('Chapter II', 3)];
    expect(chapterTitle(contents, 1)).toBe('Chapter I');
    expect(chapterTitle(contents, 3)).toBe('Chapter II');
  });

  it('are nameless where the contents don’t name them (a title page)', () => {
    expect(chapterTitle([row('  ', 3)], 3)).toBeNull();
    expect(chapterTitle([], 0)).toBeNull();
  });

  it('have neighbours in the reading order, passing those out of it', () => {
    expect(chapterBeside(spine, 1, 1)).toBe(3);
    expect(chapterBeside(spine, 3, -1)).toBe(1);
    expect(chapterBeside(spine, 2, 1)).toBe(3);
    expect(chapterBeside(spine, 3, 1)).toBeNull();
    expect(chapterBeside(spine, 0, -1)).toBeNull();
  });
});
