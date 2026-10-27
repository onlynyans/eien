import { describe, expect, it } from 'vitest';
import { PLACES_KEPT, placeKey, placesOf, withPlace } from './places';
import type { Story, StoryChapter } from './story';

const chapter = (number: number): StoryChapter => ({
  number,
  title: '',
  summary: '',
  notes: '',
  body: '<p>x</p>',
  endNotes: '',
});

const story = (chapters: StoryChapter[]): Story => ({
  site: 'ao3',
  id: 'ao3:7',
  title: 'T',
  authors: [],
  fandoms: [],
  summary: '',
  notes: '',
  endNotes: '',
  facts: [],
  chapters,
  chapterCount: 3,
  previous: false,
  next: true,
});

describe('placeKey', () => {
  it('is the chapter, or the whole work shown at once', () => {
    expect(placeKey(story([chapter(2)]))).toBe('ao3:7/2');
    expect(placeKey(story([chapter(1), chapter(2)]))).toBe('ao3:7/all');
  });
});

describe('withPlace', () => {
  it('keeps the place, within the page', () => {
    expect(withPlace({}, 'k', 1.4, 5)).toEqual({ k: { at: 1, seen: 5 } });
    expect(withPlace({}, 'k', Number.NaN, 5)).toEqual({ k: { at: 0, seen: 5 } });
  });

  it('keeps only the newest, the one just read among them', () => {
    let places = {};
    for (let i = 0; i < PLACES_KEPT + 3; i++) places = withPlace(places, `k${i}`, 0.5, i);
    expect(Object.keys(places)).toHaveLength(PLACES_KEPT);
    expect(places).not.toHaveProperty('k0');
    // Another device's clock ahead of this one's never pushes out what was just read.
    const ahead = withPlace(places, 'now', 0.1, -1);
    expect(ahead).toHaveProperty('now');
  });

  it('keeps a "__proto__" key as a plain key', () => {
    const places = withPlace({}, '__proto__', 0.5, 1);
    expect(Object.keys(places)).toEqual(['__proto__']);
  });
});

describe('placesOf', () => {
  it('keeps only places', () => {
    expect(placesOf({ a: { at: 0.5, seen: 1 }, b: { at: 2, seen: 1 }, c: 'x' })).toEqual({
      a: { at: 0.5, seen: 1 },
    });
    expect(placesOf([1])).toEqual({});
    expect(placesOf(null)).toEqual({});
  });
});
