// Tags as writers write them, and every place a "#" is not a tag.

import { describe, expect, it } from 'vitest';
import { readMarkdown } from '../markdown';
import { readNote } from '../note';
import {
  buildTagTree,
  frontMatterTags,
  hasTag,
  inlineTags,
  tagKey,
  tidyTag,
  uniqueTags,
} from './index';

/** The inline tags in a note's body, as the index finds them. */
const tagsIn = (body: string) => inlineTags(readMarkdown(body).taggable);

describe('inline tags', () => {
  it('finds a tag at the start, after a space, and at the end of a line', () => {
    expect(tagsIn('#draft first')).toEqual(['draft']);
    expect(tagsIn('a line #draft')).toEqual(['draft']);
    expect(tagsIn('one\n#two\nthree #four')).toEqual(['two', 'four']);
  });

  it('stops at punctuation: a tag can end a sentence', () => {
    expect(tagsIn('Done #draft. Next #fic/aot, then #wip! And #why?')).toEqual([
      'draft',
      'fic/aot',
      'wip',
      'why',
    ]);
    expect(tagsIn('(#aside) and "#quoted"')).toEqual([]); // only after a space or at the start
  });

  it('keeps letters from any script, with accents composed or not', () => {
    expect(tagsIn('#日本語 #café #ñandú #über')).toEqual(['日本語', 'café', 'ñandú', 'über']);
    const separate = '#café'; // "é" typed as e + a combining accent
    expect(tagsIn(separate)).toEqual(['café']);
    expect(tagKey(tagsIn(separate)[0] ?? '')).toBe(tagKey('café'));
  });

  it('nests with a slash, and tidies empty parts away', () => {
    expect(tagsIn('#fic/aot/levi')).toEqual(['fic/aot/levi']);
    expect(tagsIn('#fic//aot #fic/')).toEqual(['fic/aot', 'fic']);
    expect(tagsIn('#/fic')).toEqual([]);
  });

  it('wants a letter: "#1", "#2026" and "#_" are not tags, "#1st" is', () => {
    expect(tagsIn('Chapter #1, in #2026, #_ and #--')).toEqual([]);
    expect(tagsIn('the #1st draft, #2026-plans')).toEqual(['1st', '2026-plans']);
  });

  it('is never a heading’s mark, an escaped "#", or a "#" inside a word', () => {
    expect(tagsIn('# Title\n## Part #two')).toEqual(['two']);
    expect(tagsIn('\\#notatag and C#sharp and a#b')).toEqual([]);
    expect(tagsIn('&#8212; and &#x2014;')).toEqual([]);
  });

  it('is never in code, inline or in a block, fenced or indented', () => {
    expect(tagsIn('see `#notatag` here #real')).toEqual(['real']);
    expect(tagsIn('```\n#notatag\n```\n#real')).toEqual(['real']);
    expect(tagsIn('~~~md\n#notatag\n~~~')).toEqual([]);
    expect(tagsIn('para\n\n    #indented code\n\nafter #real')).toEqual(['real']);
  });

  it('is never in a link, an address, a wiki link or HTML', () => {
    expect(tagsIn('[#notatag](https://x.org/#frag) #real')).toEqual(['real']);
    expect(tagsIn('<https://x.org/#frag> https://y.org/#frag www.z.org/#a')).toEqual([]);
    expect(tagsIn('[[Note#Heading]] [[#notatag]]')).toEqual([]);
    expect(tagsIn('<span title="#notatag">#real</span>')).toEqual(['real']);
    expect(tagsIn('<div>\n#notatag\n</div>')).toEqual([]);
  });

  it('counts a tag inside emphasis, a quote or a list', () => {
    expect(tagsIn('**#bold** *#soft* ==#lit==\n> #quoted\n- #listed\n- [ ] #task')).toEqual([
      'bold',
      'soft',
      'lit',
      'quoted',
      'listed',
      'task',
    ]);
  });
});

describe('front matter tags', () => {
  it('reads a flow list, a block list, and a comma or space separated line', () => {
    expect(frontMatterTags('tags: [fic/aot, draft]')).toEqual(['fic/aot', 'draft']);
    expect(frontMatterTags('tags:\n  - one\n  - "two words"\n  - three')).toEqual(['one', 'three']);
    expect(frontMatterTags('tags: a, b c')).toEqual(['a', 'b', 'c']);
  });

  it('takes a "#" off an item, and leaves numbers and nesting it can’t read', () => {
    expect(frontMatterTags('tags: ["#draft", 2026, true, null, {x: 1}, [y]]')).toEqual(['draft']);
  });

  it('has none when the YAML is broken, empty, or has no tags', () => {
    expect(frontMatterTags('tags: [unclosed')).toEqual([]);
    expect(frontMatterTags('')).toEqual([]);
    expect(frontMatterTags('id: 01JB2X\ntitle: x')).toEqual([]);
    expect(frontMatterTags('- just\n- a list')).toEqual([]);
    expect(frontMatterTags('tags:')).toEqual([]);
  });

  it('survives a repeated key and a YAML bomb', () => {
    expect(frontMatterTags('tags: [a]\ntags: [b]')).toEqual(['b']);
    const bomb =
      'a: &a ["x","x"]\nb: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]\nc: &c [*b,*b,*b,*b,*b,*b,*b,*b,*b]\ntags: [*c, *c, *c]';
    expect(() => frontMatterTags(bomb)).not.toThrow();
  });
});

describe('a note’s tags', () => {
  it('joins front matter and inline tags, once each, case aside, first spelling kept', () => {
    const note = readNote('---\ntags: [Draft, fic/AoT]\n---\nBody #draft #fic/aot #new\n', 'Note');
    expect(note.tags).toEqual(['Draft', 'fic/AoT', 'new']);
  });

  it('never reads the front matter as inline tags, CRLF or not', () => {
    expect(readNote('---\r\ntitle: "#nope"\r\n---\r\n#yes\r\n', 'N').tags).toEqual(['yes']);
    expect(readNote('﻿---\ntags: [a]\n---\n', 'N').tags).toEqual(['a']);
  });

  it('reads an unclosed front matter block as text, not YAML', () => {
    expect(readNote('---\ntags: [hidden]\n#seen\n', 'N').tags).toEqual(['seen']);
  });
});

describe('tidyTag and uniqueTags', () => {
  it('refuses what isn’t a tag', () => {
    for (const bad of ['', '#', '##x', 'two words', 'a.b', '1984', 'tag!', ' x'])
      expect(tidyTag(bad)).toBeNull();
    expect(tidyTag('#Fic/AoT/')).toBe('Fic/AoT');
  });

  it('keeps the first spelling of each', () => {
    expect(uniqueTags(['Draft', 'draft', 'DRAFT', 'other'])).toEqual(['Draft', 'other']);
  });
});

describe('the tag tree', () => {
  const notes = [
    { path: 'b.md', tags: ['fic/aot', 'draft'] },
    { path: 'a.md', tags: ['Fic/AoT/levi', 'fic'] },
    { path: 'c.md', tags: ['research'] },
    { path: 'd.md', tags: [] },
  ];

  it('nests by "/", counts each note once per tag, and spells from the first note by path', () => {
    const tree = buildTagTree(notes);
    expect(tree.map((t) => [t.name, t.count])).toEqual([
      ['draft', 1],
      ['Fic', 2],
      ['research', 1],
    ]);
    const fic = tree[1];
    expect(fic?.tag).toBe('Fic');
    expect(fic?.children.map((t) => [t.tag, t.count])).toEqual([['Fic/AoT', 2]]);
    expect(fic?.children[0]?.children.map((t) => [t.tag, t.key, t.count])).toEqual([
      ['Fic/AoT/levi', 'fic/aot/levi', 1],
    ]);
  });

  it('matches a note by its tag or one under it, case aside, and not by a prefix of a name', () => {
    expect(hasTag(['Fic/AoT/levi'], 'fic')).toBe(true);
    expect(hasTag(['Fic/AoT/levi'], 'fic/aot')).toBe(true);
    expect(hasTag(['fiction'], 'fic')).toBe(false);
    expect(hasTag([], 'fic')).toBe(false);
  });

  it('is empty for no tags', () => {
    expect(buildTagTree([])).toEqual([]);
    expect(buildTagTree([{ path: 'x.md', tags: [] }])).toEqual([]);
  });
});
