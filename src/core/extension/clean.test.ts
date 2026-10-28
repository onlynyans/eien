import { describe, expect, it } from 'vitest';
import { shown } from '../../../tests/support/clean-nodes';
import { cleanStory } from './clean';

const clean = (html: string) => shown(cleanStory(html));

describe('cleanStory: a story site’s addresses', () => {
  it('keeps links to the web and to mail, and only words for the rest', () => {
    expect(clean('<a href="https://ao3.org/works/1" target="_top">w</a>')).toBe(
      '<a href="https://ao3.org/works/1">w</a>',
    );
    expect(clean('<a href="mailto:a@b.c">m</a>')).toBe('<a href="mailto:a@b.c">m</a>');
    expect(clean('<a href="java\tscript:alert(1)">j</a>')).toBe('<a>j</a>');
    expect(clean('<a href="/works/1">r</a>')).toBe('<a>r</a>');
    expect(clean('<a href="data:text/html,x">d</a>')).toBe('<a>d</a>');
  });

  it('shows an image from https, and only its words from anywhere else', () => {
    expect(clean('<img src="https://i.example/a.png" alt="A map" width="900" onerror="x()">')).toBe(
      '<img src="https://i.example/a.png" alt="A map"></img>',
    );
    expect(clean('<p><img src="http://i.example/a.png" alt="A map"></p>')).toBe('<p>[A map]</p>');
    expect(clean('<img src="javascript:x()">')).toBe('');
  });

  it('reads an address as a browser does, its spaces and control characters ignored', () => {
    expect(clean('<a href=" https://ao3.org/\nworks/1 ">w</a>')).toBe(
      '<a href="https://ao3.org/works/1">w</a>',
    );
  });

  it('names no part of a story', () => {
    expect(clean('<h2 class="title">One</h2><hr>')).toBe('<h2>One</h2><hr></hr>');
  });
});
