import { describe, expect, it } from 'vitest';
import { cleanHtml } from '../../core/reader';
import { drawClean } from './draw-clean';

const drawn = (html: string) => {
  const box = document.createElement('div');
  box.append(drawClean(cleanHtml(html)));
  return box;
};

describe('drawClean', () => {
  it('draws a rule as Eien’s scene break', () => {
    const box = drawn('<p>a</p><hr><p>b</p>');
    expect(box.querySelector('hr')).toBeNull();
    expect(box.querySelector('.scene-break')?.getAttribute('role')).toBe('separator');
  });

  it('opens a link in a tab of its own, telling the site nothing', () => {
    const link = drawn('<a href="https://example.org/">x</a>').querySelector('a');
    expect(link?.getAttribute('href')).toBe('https://example.org/');
    expect(link?.target).toBe('_blank');
    expect(link?.rel).toBe('noopener noreferrer');
  });

  it('keeps where a block sits as data, never a style', () => {
    const p = drawn('<p style="text-align:center">c</p>').querySelector('p');
    expect(p?.dataset.align).toBe('center');
    expect(p?.getAttribute('style')).toBeNull();
  });

  it('draws an image lazily, its words beside it', () => {
    const img = drawn('<img src="https://i.example/a.png" alt="A map">').querySelector('img');
    expect(img?.getAttribute('alt')).toBe('A map');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });

  it('draws words that look like HTML as words', () => {
    expect(drawn('<p>&lt;script&gt;x()&lt;/script&gt;</p>').innerHTML).toBe(
      '<p>&lt;script&gt;x()&lt;/script&gt;</p>',
    );
  });
});
