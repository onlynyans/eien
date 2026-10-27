import { describe, expect, it } from 'vitest';
import { tagAndIdLines } from './tag-id-lines';

/** The text of each span, for reading the tests. */
const texts = (text: string, which: 'hidden' | 'kept') =>
  tagAndIdLines(text)[which].map((span) => text.slice(span.from, span.to));

describe('the front matter’s tags: and id: lines', () => {
  it('are the whole front matter when they’re all it holds', () => {
    for (const [front, after] of [
      ['---\nid: CSHE541J35\n---', '\nBody'],
      ['---\nid: CSHE541J35\ntags: [fic, draft]\n---', '\nBody'],
      ['---\ntags:\n  - fic\n  - draft\n---', '\n'],
      ['---\ntags: [fic]\n\nid: X\n...', '\nBody'],
      ['---\nid: X\n---', ''],
    ] as const) {
      const text = front + after;
      expect(texts(text, 'hidden'), text).toEqual([front]);
      expect(texts(text, 'kept'), text).toEqual([front]);
    }
  });

  it('are those lines alone among the writer’s other keys, the "---" lines kept too', () => {
    const text = '---\ntitle: Needle\nid: X\nsummary: A tale\ntags:\n- fic\n- draft\n---\nBody';
    expect(texts(text, 'hidden')).toEqual(['id: X', 'tags:\n- fic\n- draft']);
    expect(texts(text, 'kept')).toEqual(['---', 'id: X', 'tags:\n- fic\n- draft\n---']);
  });

  it('take a comment after the value, and every line of a list or a block', () => {
    const text =
      '---\ntitle: T\ntags: [a, b] # mine\nid: |\n  long\n  id\n# the writer’s note\n---\n';
    expect(texts(text, 'hidden')).toEqual(['tags: [a, b] # mine\nid: |\n  long\n  id']);
  });

  it('are none for no front matter, broken YAML, a flow map, or other keys alone', () => {
    for (const text of [
      'Body\n---\nid: X\n---\n',
      '---\nid: [\n---\nBody',
      '---\n{id: X, tags: [a]}\n---\nBody',
      '---\n- id\n---\n',
      '---\ntitle: T\nidea: x\ntag: y\n---\n',
      '---\n---\nBody',
      'id: X',
    ]) {
      expect(tagAndIdLines(text), text).toEqual({ hidden: [], kept: [] });
    }
  });

  it('are each `tags:` written twice, and a key with nothing after it', () => {
    const text = '---\ntags:\ntitle: T\nid:\ntags: [b]\n---\n';
    expect(texts(text, 'hidden')).toEqual(['tags:', 'id:\ntags: [b]']);
  });
});
