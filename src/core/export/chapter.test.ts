import { describe, expect, it } from 'vitest';
import { chapterOf, wordsOf } from './chapter';

const chapter = (markdown: string, title = 'Mending', ids = '') =>
  chapterOf({ title, markdown }, 'curly', ids);

const ref = (n: number, first = true, ids = '') =>
  `<sup><a class="noteref" epub:type="noteref"${first ? ` id="${ids}fnref${n}"` : ''} href="#${ids}fn${n}">${n}</a></sup>`;

describe('a chapter’s heading', () => {
  it('is the note’s title', () => {
    const c = chapter('Words.', 'Fire & Ice');
    expect(c.heading).toBe('Fire &amp; Ice');
    expect(c.headingText).toBe('Fire & Ice');
    expect(c.blocks).toEqual(['<p>Words.</p>']);
  });

  it('is the note’s own top-level heading when it begins with one, not shown twice', () => {
    const c = chapter('# The *Scarf*\n\nWords.\n\n# Later');
    expect(c.heading).toBe('The <em>Scarf</em>');
    expect(c.headingText).toBe('The Scarf');
    expect(c.blocks).toEqual(['<p>Words.</p>', '<h2>Later</h2>']);
  });

  it('isn’t a second-level heading, or a heading after the first block', () => {
    expect(chapter('## Part\n\nWords.').heading).toBe('Mending');
    expect(chapter('Words.\n\n# Late').heading).toBe('Mending');
  });

  it('comes after the front matter, which is never shown', () => {
    const c = chapter('---\nid: N1\ntags: [a]\n---\n# Title\n\nWords.');
    expect(c.heading).toBe('Title');
    expect(c.blocks).toEqual(['<p>Words.</p>']);
  });

  it('reads a byte-order mark and Windows line ends', () => {
    const c = chapter('﻿---\r\nid: N1\r\n---\r\n# Title\r\n\r\nOne\r\ntwo');
    expect(c.heading).toBe('Title');
    expect(c.blocks).toEqual(['<p>One<br />\ntwo</p>']);
  });
});

describe('a chapter’s words, as a book has them', () => {
  it('highlights, centres scene breaks, and curls quotes', () => {
    expect(chapter('"A ==mark==."\n\n***\n\nAfter.').blocks).toEqual([
      '<p>“A <mark>mark</mark>.”</p>',
      '<p class="scene-break">* * *</p>',
      '<p>After.</p>',
    ]);
  });

  it('keeps links to the web and mail, and makes others their words', () => {
    expect(
      chapter('[web](https://a.org) [mail](mailto:a@b.org) [note](Other.md) [js](javascript:x)')
        .blocks,
    ).toEqual(['<p><a href="https://a.org">web</a> <a href="mailto:a@b.org">mail</a> note js</p>']);
  });

  it('makes an image its description', () => {
    expect(chapter('![A *red* scarf](attachments/scarf.png)').blocks).toEqual([
      '<p>A <em>red</em> scarf</p>',
    ]);
  });
});

describe('footnotes', () => {
  it('are numbered as they’re first referred to', () => {
    const c = chapter('One[^b] two[^a] three[^b].\n\n[^a]: Note A.\n[^b]: Note B.');
    expect(c.blocks).toEqual([`<p>One${ref(1)} two${ref(2)} three${ref(1, false)}.</p>`]);
    expect(c.notes).toEqual([
      { blocks: ['<p>Note B.</p>'], referred: true },
      { blocks: ['<p>Note A.</p>'], referred: true },
    ]);
  });

  it('side by side are two marks (the parser reads "^1][^" as superscript)', () => {
    expect(chapter('Word[^1][^2]\n\n[^1]: One.\n[^2]: Two.').blocks).toEqual([
      `<p>Word${ref(1)}${ref(2)}</p>`,
    ]);
  });

  it('with no note stay as written; a note never referred to comes last', () => {
    const c = chapter('Text[^none] and[^a].\n\n[^lost]: Lost.\n\n[^a]: Found.');
    expect(c.blocks).toEqual([`<p>Text[^none] and${ref(1)}.</p>`]);
    expect(c.notes).toEqual([
      { blocks: ['<p>Found.</p>'], referred: true },
      { blocks: ['<p>Lost.</p>'], referred: false },
    ]);
  });

  it('may refer to further notes', () => {
    const c = chapter('Text[^a].\n\n[^a]: See[^b].\n[^b]: Deeper.');
    expect(c.notes.map((note) => note.blocks)).toEqual([
      [`<p>See${ref(2)}.</p>`],
      ['<p>Deeper.</p>'],
    ]);
  });

  it('are referred to only when a mark leads to them from the text', () => {
    // Only itself, or only a note nothing leads to: in the flow, not a pop-up.
    const c = chapter('Text.\n\n[^a]: Self[^a].\n[^b]: To[^c].\n[^c]: End.');
    expect(c.notes.map((note) => note.referred)).toEqual([false, false, false]);
    const d = chapter('Text[^b].\n\n[^b]: To[^c].\n[^c]: End.');
    expect(d.notes.map((note) => note.referred)).toEqual([true, true]);
  });

  it('take their ids after `ids`, so one page can hold every chapter', () => {
    expect(chapter('A[^1]\n\n[^1]: N.', 'T', 'c3-').blocks).toEqual([
      `<p>A${ref(1, true, 'c3-')}</p>`,
    ]);
  });

  it('are text in code, and in a heading leave the heading’s words alone', () => {
    const c = chapter('# Title[^1]\n\n`code[^1]`\n\n[^1]: N.');
    expect(c.heading).toBe(`Title${ref(1)}`);
    expect(c.headingText).toBe('Title');
    expect(c.blocks).toEqual(['<p><code>code[^1]</code></p>']);
  });

  it('can’t be faked by a note’s own reference to the character a mark uses', () => {
    const c = chapter('A &#x0F0001; b[^1].\n\n[^1]: N.\n\n`&#x0F0001;`');
    expect(c.blocks).toEqual([
      `<p>A &#983041; b${ref(1)}.</p>`,
      '<p><code>&amp;#x0F0001;</code></p>',
    ]);
  });

  it('keep the curly quotes about them', () => {
    expect(chapter('"Said,"[^1] she.\n\n[^1]: "Quoted."').notes[0]?.blocks).toEqual([
      '<p>“Quoted.”</p>',
    ]);
    expect(chapter('"Said,"[^1] she.\n\n[^1]: N.').blocks).toEqual([
      `<p>“Said,”${ref(1)} she.</p>`,
    ]);
  });
});

describe('wordsOf', () => {
  it('reads inline HTML as words', () => {
    expect(wordsOf('The <em>Scarf</em> &amp;\n  more&#x0F0001;')).toBe('The Scarf & more');
  });
});
