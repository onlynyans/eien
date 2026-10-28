import { describe, expect, it, vi } from 'vitest';
import { type CleanElement, type CleanNode, type CleanRules, cleanHtml } from '../core/html';
import { drawClean } from './draw-clean';

/** Rules as an EPUB's might be: links on the page and its own images, a part or two. */
const RULES: CleanRules = {
  link: (href) => href,
  image: (src) => (src.startsWith('https:') ? src : null),
  part: (source, name) =>
    source.attrs['epub:type'] === 'title' ? 'chapter-title' : name === 'hr' ? 'scene-break' : null,
};

const box = (nodes: readonly CleanNode[], link?: (anchor: HTMLAnchorElement) => void) => {
  const element = document.createElement('div');
  element.append(drawClean(nodes, { link }));
  return element;
};

const drawn = (html: string) => box(cleanHtml(html, { ...RULES, part: undefined }));

/** A node the cleaner would never give, as a caller's mistake might. */
const made = (name: string, attrs: Record<string, string> = {}, more = {}): CleanElement => ({
  kind: 'element',
  name,
  attrs,
  children: [{ kind: 'text', text: 'x' }],
  ...more,
});

describe('drawClean', () => {
  it('draws a rule as Eien’s scene break', () => {
    const element = drawn('<p>a</p><hr><p>b</p>');
    expect(element.querySelector('hr')).toBeNull();
    expect(element.querySelector('.scene-break')?.getAttribute('role')).toBe('separator');
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

  it('hands each link that goes somewhere to the caller, who says how it opens', () => {
    const link = vi.fn();
    const element = box(cleanHtml('<a href="#n1">1</a><a>2</a>', RULES), link);
    expect(link).toHaveBeenCalledTimes(1);
    expect(link).toHaveBeenCalledWith(element.querySelector('a[href="#n1"]'));
    expect(element.querySelector('a')?.hasAttribute('target')).toBe(false);
  });

  it('names a part for a stylesheet, a scene break’s on Eien’s break', () => {
    const element = box(cleanHtml('<h1 epub:type="title">One</h1><hr>', RULES));
    expect(element.querySelector('h1')?.dataset.part).toBe('chapter-title');
    expect(element.querySelector<HTMLElement>('.scene-break')?.dataset.part).toBe('scene-break');
  });
});

describe('drawClean: what it’s handed is checked again', () => {
  it('never makes an element the cleaner doesn’t keep, drawing its words in its place', () => {
    const element = box([made('script'), made('iframe', { src: 'https://e.x' }), made('style')]);
    expect(element.innerHTML).toBe('xxx');
  });

  it('never sets an attribute it doesn’t know', () => {
    const p = box([made('p', { onclick: 'x()', style: 'color:red', class: 'y' })]).querySelector(
      'p',
    );
    expect(p?.attributes).toHaveLength(0);
  });

  it('follows no link but to the web, mail or the page', () => {
    for (const href of [
      'javascript:x()',
      ' javascript:x()',
      'data:text/html,x',
      'chapter2.xhtml',
    ]) {
      expect(
        box([made('a', { href })])
          .querySelector('a')
          ?.hasAttribute('href'),
      ).toBe(false);
    }
    expect(
      box([made('a', { href: 'HTTPS://e.x' })])
        .querySelector('a')
        ?.getAttribute('href'),
    ).toBe('HTTPS://e.x');
  });

  it('shows no image but from https or the window’s own copy, only its words', () => {
    for (const src of ['http://i.example/a.png', 'javascript:x()', 'data:image/png,x', 'a.png']) {
      expect(box([made('img', { src, alt: ' Map ' })]).innerHTML).toBe('[Map]');
    }
    expect(box([made('img', { src: 'blob:eien/1', alt: '' })]).querySelector('img')?.src).toBe(
      'blob:eien/1',
    );
  });

  it('names no part it doesn’t know', () => {
    const p = box([made('p', {}, { part: 'onclick' })]).querySelector('p');
    expect(p?.hasAttribute('data-part')).toBe(false);
  });

  it('puts a link’s address only on a link, and an image’s only on an image', () => {
    const p = box([made('p', { href: 'https://e.x', src: 'https://e.x/a.png' })]).querySelector(
      'p',
    );
    expect(p?.attributes).toHaveLength(0);
  });
});
