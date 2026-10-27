import { describe, expect, it, vi } from 'vitest';
import type { Story, StoryChapter } from '../../core/reader';
import { placeIn, storySheet } from './story-sheet';

const chapter = (number: number, more: Partial<StoryChapter> = {}): StoryChapter => ({
  number,
  title: '',
  summary: '',
  notes: '',
  body: '<p>One two three.</p>',
  endNotes: '',
  ...more,
});

const story = (more: Partial<Story> = {}): Story => ({
  site: 'ao3',
  id: 'ao3:1',
  title: 'Beneath the Walls',
  authors: ['Rook', 'Wren'],
  fandoms: ['Harry Potter'],
  summary: '',
  notes: '',
  endNotes: '',
  facts: [],
  chapters: [chapter(4, { title: 'The Gate' })],
  chapterCount: 12,
  previous: true,
  next: true,
  ...more,
});

describe('storySheet', () => {
  it('heads the sheet with the fandom, the title and the chapter, then the title and who wrote it', () => {
    const { element } = storySheet(story(), 'roman', () => {});
    expect(element.querySelector('.crumbs')?.textContent).toBe(
      'Harry Potter / Beneath the Walls / iv',
    );
    expect(element.querySelector('h1')?.textContent).toBe('Beneath the Walls');
    expect(element.querySelector('.reader__byline')?.textContent).toBe('by Rook, Wren');
    expect(element.querySelector('.reader__chapter-head')?.textContent).toBe('Chapter ivThe Gate');
  });

  it('counts the chapters’ words', () => {
    expect(storySheet(story(), 'roman', () => {}).words).toBe(3);
  });

  it('shows a note only where it has words', () => {
    const { element } = storySheet(
      story({ summary: '<p> </p>', notes: '<p>For S.</p>' }),
      'roman',
      () => {},
    );
    expect(
      [...element.querySelectorAll('.reader__aside')].map((a) => a.getAttribute('aria-label')),
    ).toEqual(['Notes']);
  });

  it('leaves a work of one untitled chapter without a chapter heading', () => {
    const { element } = storySheet(
      story({ chapters: [chapter(1)], chapterCount: 1, previous: false, next: false }),
      'roman',
      () => {},
    );
    expect(element.querySelector('.reader__chapter-head')).toBeNull();
    expect(element.querySelector('.reader__turns')).toBeNull();
  });

  it('turns from its foot', () => {
    const turn = vi.fn();
    const { element } = storySheet(story({ previous: false }), 'arabic', turn);
    const buttons = [...element.querySelectorAll<HTMLButtonElement>('.reader__turns button')];
    expect(buttons.map((b) => b.textContent)).toEqual(['Next chapter']);
    buttons[0]?.click();
    expect(turn).toHaveBeenCalledWith({ to: 'next' });
  });

  it('says what the site says of the work, folded', () => {
    const { element } = storySheet(
      story({ facts: [{ label: 'Rating', values: ['Teen', 'Mature'] }] }),
      'roman',
      () => {},
    );
    const facts = element.querySelector('details.reader__facts');
    expect(facts?.hasAttribute('open')).toBe(false);
    expect(facts?.querySelector('dd')?.textContent).toBe('Teen · Mature');
  });
});

describe('placeIn', () => {
  it('names the chapters shown, of how many', () => {
    expect(placeIn(story(), 'roman')).toBe('iv of 12');
    expect(
      placeIn(story({ chapters: [chapter(1), chapter(2)], chapterCount: null }), 'arabic'),
    ).toBe('1–2 of ?');
  });
});
