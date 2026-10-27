import { describe, expect, it } from 'vitest';
import { pageAnswer, pageMessage, storyAsk, storyMessage } from './messages';
import { storyOf } from './story';

const good = {
  site: 'ffn',
  id: 'ffn:42',
  title: 'Beneath the Walls',
  authors: ['Rook'],
  fandoms: ['Harry Potter'],
  summary: '<p>A siege.</p>',
  notes: '',
  endNotes: '',
  facts: [{ label: 'Rated', values: ['T'] }],
  chapters: [{ number: 2, title: 'Walls', summary: '', notes: '', body: '<p>x</p>', endNotes: '' }],
  chapterCount: 12,
  previous: true,
  next: true,
};

describe('storyOf', () => {
  it('takes a story', () => {
    expect(storyOf(good)).toEqual(good);
    expect(storyOf({ ...good, chapterCount: null })?.chapterCount).toBeNull();
  });

  it('refuses what isn’t one', () => {
    expect(storyOf(null)).toBeNull();
    expect(storyOf({ ...good, site: 'tumblr' })).toBeNull();
    expect(storyOf({ ...good, site: '__proto__' })).toBeNull();
    expect(storyOf({ ...good, id: 'ao3:42' })).toBeNull();
    expect(storyOf({ ...good, chapters: [] })).toBeNull();
    expect(storyOf({ ...good, chapterCount: 0 })).toBeNull();
    expect(storyOf({ ...good, authors: [1] })).toBeNull();
    expect(storyOf({ ...good, next: 'yes' })).toBeNull();
    expect(storyOf({ ...good, title: 'x'.repeat(5000) })).toBeNull();
    expect(storyOf({ ...good, chapters: [{ ...good.chapters[0], number: 0 }] })).toBeNull();
  });
});

describe('messages', () => {
  it('reads the story sent to the story page, and nothing else', () => {
    expect(storyMessage({ eien: 'story', story: good })?.title).toBe('Beneath the Walls');
    expect(storyMessage({ eien: 'turn', story: good })).toBeNull();
    expect(storyMessage('story')).toBeNull();
  });

  it('reads the story page’s asks, never an address', () => {
    expect(storyAsk({ eien: 'ready' })).toEqual({ eien: 'ready' });
    expect(storyAsk({ eien: 'turn', to: 'next', href: 'https://e.x' })).toEqual({
      eien: 'turn',
      to: 'next',
    });
    expect(storyAsk({ eien: 'turn', to: 'chapter', number: 3 })).toEqual({
      eien: 'turn',
      to: 'chapter',
      number: 3,
    });
    expect(storyAsk({ eien: 'turn', to: 'chapter', number: 1.5 })).toBeNull();
    expect(storyAsk({ eien: 'turn', to: 'https://e.x' })).toBeNull();
    expect(storyAsk(null)).toBeNull();
  });
});

describe('the popup and the page', () => {
  it('reads the popup’s asks and the page’s answers', () => {
    expect(pageMessage({ eien: 'which' })).toEqual({ eien: 'which' });
    expect(pageMessage({ eien: 'open', extra: 'x' })).toEqual({ eien: 'open' });
    expect(pageMessage({ eien: 'turn' })).toBeNull();
    expect(pageAnswer({ title: 'T' })).toEqual({ title: 'T' });
    expect(pageAnswer(undefined)).toBeNull();
    expect(pageAnswer({ title: 3 })).toBeNull();
  });
});
