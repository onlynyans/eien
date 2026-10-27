import { describe, expect, it } from 'vitest';
import { FFN_CHAPTER, FFN_ONESHOT, FFN_PHONE } from '../../../../tests/support/story-pages/ffn';
import { FFN } from './ffn';

const page = (html: string) => new DOMParser().parseFromString(html, 'text/html');

describe('FanFiction.Net: a chapter', () => {
  const at = new URL('https://www.fanfiction.net/s/42/2/Beneath-the-Walls');
  const found = FFN.read(page(FFN_CHAPTER), at);
  const story = found?.story;

  it('reads the story', () => {
    expect(story?.id).toBe('ffn:42');
    expect(story?.title).toBe('Beneath the Walls');
    expect(story?.authors).toEqual(['Rook']);
    expect(story?.fandoms).toEqual(['Harry Potter']);
    expect(story?.summary).toBe('The walls held for forty days &amp; nights.');
    expect(story?.chapterCount).toBe(3);
  });

  it('reads its line of details, without the counts of reviews and follows', () => {
    expect(story?.facts).toEqual([
      { label: 'About', values: ['English', 'Drama/Romance', 'Hermione G., Ron W.'] },
      { label: 'Rated', values: ['T'] },
      { label: 'Words', values: ['12,345'] },
      { label: 'Updated', values: ['Mar 3'] },
      { label: 'Published', values: ['Jan 2'] },
    ]);
  });

  it('reads the chapter, titled from the chapter list', () => {
    expect(story?.chapters).toEqual([
      expect.objectContaining({
        number: 2,
        title: 'The Gate',
        body: expect.stringContaining('groaned'),
      }),
    ]);
  });

  it('turns by the story’s own addresses, within its chapters', () => {
    expect(story?.previous).toBe(true);
    expect(story?.next).toBe(true);
    expect(found?.turnTo({ to: 'next' })).toBe(
      'https://www.fanfiction.net/s/42/3/Beneath-the-Walls',
    );
    expect(found?.turnTo({ to: 'chapter', number: 1 })).toBe(
      'https://www.fanfiction.net/s/42/1/Beneath-the-Walls',
    );
    expect(found?.turnTo({ to: 'chapter', number: 4 })).toBeNull();
  });
});

describe('FanFiction.Net: other pages', () => {
  it('reads a one-shot', () => {
    const found = FFN.read(page(FFN_ONESHOT), new URL('https://www.fanfiction.net/s/43/1/Lantern'));
    expect(found?.story).toEqual(
      expect.objectContaining({
        title: 'Lantern',
        fandoms: ['Naruto'],
        chapterCount: 1,
        previous: false,
        next: false,
      }),
    );
    expect(found?.story.facts).toContainEqual({ label: 'Status', values: ['Complete'] });
    expect(found?.turnTo({ to: 'next' })).toBeNull();
  });

  it('reads the phone site’s chapter, its turns from its links', () => {
    const found = FFN.read(
      page(FFN_PHONE),
      new URL('https://m.fanfiction.net/s/42/2/Beneath-the-Walls'),
    );
    expect(found?.story).toEqual(
      expect.objectContaining({
        title: 'Beneath the Walls',
        authors: ['Rook'],
        chapterCount: null,
        previous: true,
        next: true,
      }),
    );
    expect(found?.story.chapters[0]?.title).toBe('The Gate');
    expect(found?.turnTo({ to: 'next' })).toBe('https://m.fanfiction.net/s/42/3/Beneath-the-Walls');
  });

  it('reads nothing where there’s no story', () => {
    expect(
      FFN.read(page(FFN_CHAPTER), new URL('https://www.fanfiction.net/book/Harry-Potter/')),
    ).toBeNull();
    expect(
      FFN.read(page('<p>Story Not Found</p>'), new URL('https://www.fanfiction.net/s/1/1/')),
    ).toBeNull();
  });
});
