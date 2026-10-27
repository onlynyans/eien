import { describe, expect, it } from 'vitest';
import {
  AO3_ADULT,
  AO3_CHAPTER,
  AO3_ENTIRE,
  AO3_ONESHOT,
} from '../../../../tests/support/story-pages/ao3';
import { AO3 } from './ao3';

const page = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const CHAPTER = new URL('https://archiveofourown.org/works/123/chapters/1002');

describe('AO3: a chapter', () => {
  const found = AO3.read(page(AO3_CHAPTER), CHAPTER);
  const story = found?.story;

  it('reads the work', () => {
    expect(story?.id).toBe('ao3:123');
    expect(story?.title).toBe('Beneath the Walls');
    expect(story?.authors).toEqual(['Rook', 'Wren']);
    expect(story?.fandoms).toEqual(['Harry Potter - J. K. Rowling']);
    expect(story?.chapterCount).toBe(3);
    expect(story?.summary).toBe('');
  });

  it('reads what the header says of it, in its order, with its own labels', () => {
    expect(story?.facts.map((fact) => fact.label)).toEqual([
      'Rating',
      'Archive Warning',
      'Relationship',
      'Characters',
      'Additional Tags',
      'Language',
      'Words',
    ]);
    expect(story?.facts.find((fact) => fact.label === 'Characters')?.values).toEqual([
      'Hermione Granger',
      'Ron Weasley',
    ]);
    expect(story?.facts.find((fact) => fact.label === 'Language')?.values).toEqual(['English']);
  });

  it('reads the chapter: its own title, notes and text, its addresses made whole', () => {
    const [chapter] = story?.chapters ?? [];
    expect(story?.chapters).toHaveLength(1);
    expect(chapter?.number).toBe(2);
    expect(chapter?.title).toBe('The Gate');
    expect(chapter?.summary).toContain('They open it.');
    expect(chapter?.notes).toContain('Short one.');
    expect(chapter?.notes).not.toContain('Thanks for reading');
    expect(chapter?.endNotes).toContain('Thanks for reading.');
    expect(chapter?.body).toContain('groaned');
    expect(chapter?.body).toContain('href="https://archiveofourown.org/works/9"');
    expect(chapter?.body).toContain('src="https://archiveofourown.org/images/x.png"');
  });

  it('turns to the chapters the page links, and to any in its index', () => {
    expect(story?.previous).toBe(true);
    expect(story?.next).toBe(true);
    expect(found?.turnTo({ to: 'next' })).toBe(
      'https://archiveofourown.org/works/123/chapters/1003#workskin',
    );
    expect(found?.turnTo({ to: 'previous' })).toBe(
      'https://archiveofourown.org/works/123/chapters/1001#workskin',
    );
    expect(found?.turnTo({ to: 'chapter', number: 3 })).toBe(
      'https://archiveofourown.org/works/123/chapters/1003',
    );
    expect(found?.turnTo({ to: 'chapter', number: 4 })).toBeNull();
  });
});

describe('AO3: other pages', () => {
  it('reads the whole work at once, each chapter numbered', () => {
    const story = AO3.read(
      page(AO3_ENTIRE),
      new URL('https://archiveofourown.org/works/123?view_full_work=true'),
    )?.story;
    expect(story?.chapters.map((chapter) => chapter.number)).toEqual([1, 2]);
    expect(story?.chapterCount).toBeNull();
    expect(story?.summary).toContain('<em>forty</em>');
    expect(story?.notes).toContain('For S., who asked.');
    expect(story?.endNotes).toContain('The end, for now.');
    expect(story?.next).toBe(false);
  });

  it('reads a work of one chapter', () => {
    const story = AO3.read(
      page(AO3_ONESHOT),
      new URL('https://archiveofourown.org/works/123'),
    )?.story;
    expect(story?.chapters).toEqual([
      expect.objectContaining({ number: 1, title: '', body: expect.stringContaining('Only') }),
    ]);
    expect(story?.chapterCount).toBe(1);
  });

  it('reads nothing where there’s no work: the question before one, a page that isn’t one', () => {
    expect(AO3.read(page(AO3_ADULT), new URL('https://archiveofourown.org/works/123'))).toBeNull();
    expect(
      AO3.read(page(AO3_CHAPTER), new URL('https://archiveofourown.org/tags/x/works')),
    ).toBeNull();
  });

  it('holds only the archive’s pages', () => {
    expect(AO3.holds(CHAPTER)).toBe(true);
    expect(AO3.holds(new URL('https://archiveofourown.org.evil.example/works/1'))).toBe(false);
  });
});
