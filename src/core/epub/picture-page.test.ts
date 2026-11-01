import { describe, expect, it } from 'vitest';
import type { CleanNode } from '../html';
import { chapterOf } from './chapter';

const read = (body: string) =>
  chapterOf(new TextEncoder().encode(body), 'text/chapter.xhtml', () => true).nodes;

/** The nodes as tags, a part named after a colon: what's drawn, in order. */
const shape = (nodes: readonly CleanNode[]): string =>
  nodes
    .map((node) =>
      node.kind === 'text'
        ? node.text.trim()
        : `<${node.name}${node.part ? `:${node.part}` : ''}${node.attrs.anchor ? `#${node.attrs.anchor}` : ''}>${shape(node.children)}`,
    )
    .join('');

const FRAME =
  '<div class="svg_outer"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 800 1200"><image width="800" height="1200" xlink:href="p1.jpg"/></svg></div>';

describe('a chapter that’s only a picture (#59)', () => {
  it('keeps the picture alone: no empty paragraph or line break above it to push it a page on', () => {
    expect(shape(read(`<p class="calibre1">&#160;</p>\n${FRAME}`))).toBe('<div:plate><img>');
    expect(shape(read(`<p><br/></p><p> </p><div><img src="p1.jpg"/></div><p>&#160;</p>`))).toBe(
      '<div:plate><img>',
    );
  });

  it('keeps each of its pictures, in order, the blank lines between them gone too', () => {
    const chapter = read(
      `<p>&#160;</p><div><img src="p1.jpg"/></div><p><br/></p><p>&#160;</p><div><img src="p2.jpg"/></div>`,
    );
    expect(shape(chapter)).toBe('<div:plate><img><div:plate><img>');
    const sources = chapter.flatMap((node) =>
      node.kind === 'element'
        ? node.children.map((child) => child.kind === 'element' && child.attrs.src)
        : [],
    );
    expect(sources).toEqual(['text/p1.jpg', 'text/p2.jpg']);
  });

  it('takes a Japanese book’s blank line, an ideographic space, as blank', () => {
    expect(shape(read(`<p>　</p>${FRAME}`))).toBe('<div:plate><img>');
  });

  it('keeps a place a link names in it', () => {
    expect(shape(read(`<p id="p12">&#160;</p>${FRAME}`))).toBe('<p><a#p12><div:plate><img>');
  });

  it('leaves a chapter with words as it is, blank lines and all', () => {
    expect(shape(read(`<p>&#160;</p><p>Words.</p>${FRAME}`))).toBe('<p><p>Words.<div:plate><img>');
    expect(shape(read('<p>&#160;</p><p><br/></p>'))).toBe('<p><p><br>');
  });
});
