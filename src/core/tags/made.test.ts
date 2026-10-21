import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isWatchedPath, VAULT_TAGS } from '../paths';
import { parseMadeTags, typedTag, withMadeTag } from './made';
import { buildTagTree } from './tree';

describe('made tags', () => {
  it('reads the tags made, tidied and without repeats, case aside', () => {
    expect(parseMadeTags('{"made":["draft","#Posted","DRAFT","fic//aot/"]}')).toEqual([
      'draft',
      'Posted',
      'fic/aot',
    ]);
  });

  it('reads none from no file, a broken one, or one of another shape', () => {
    expect(parseMadeTags(null)).toEqual([]);
    expect(parseMadeTags('{ not json')).toEqual([]);
    expect(parseMadeTags('["draft"]')).toEqual([]);
    expect(parseMadeTags('{"made":"draft"}')).toEqual([]);
    expect(parseMadeTags('{"made":[1, null, "#1", "ok"]}')).toEqual(['ok']);
  });

  it('a tag made goes last; made again as it is, nothing changes', () => {
    const once = withMadeTag(null, 'draft', true) ?? null;
    expect(parseMadeTags(once)).toEqual(['draft']);
    const twice = withMadeTag(once, 'posted', true) ?? null;
    expect(parseMadeTags(twice)).toEqual(['draft', 'posted']);
    expect(withMadeTag(twice, 'posted', true)).toBeUndefined();
  });

  it('a tag taken out goes, case aside; one not there changes nothing', () => {
    const file = '{"made":["draft","posted"]}';
    expect(parseMadeTags(withMadeTag(file, 'Draft', false) ?? null)).toEqual(['posted']);
    expect(withMadeTag(file, 'ideas', false)).toBeUndefined();
  });

  it('keeps the file’s other fields, and refuses to change one that isn’t JSON', () => {
    const next = withMadeTag('{"order":["b","a"],"made":[]}', 'x', true);
    expect(JSON.parse(next ?? '')).toEqual({ order: ['b', 'a'], made: ['x'] });
    expect(withMadeTag('{ broken', 'x', true)).toBeNull();
    expect(withMadeTag('[1,2]', 'x', true)).toBeNull();
  });

  it('a typed tag: with or without its #, trimmed; nothing that can’t be a tag', () => {
    expect(typedTag('  #fic/aot ')).toBe('fic/aot');
    expect(typedTag('draft')).toBe('draft');
    expect(typedTag('two words')).toBeNull();
    expect(typedTag('#123')).toBeNull();
    expect(typedTag('')).toBeNull();
  });

  it('the file is watched, so another device’s new tag shows', () => {
    expect(isWatchedPath(VAULT_TAGS)).toBe(true);
  });

  it('property: whatever is made can be read back, once each, case aside', () => {
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z][a-z0-9-]{0,8}$/), { maxLength: 8 }),
        (tags) => {
          let text: string | null = null;
          for (const tag of tags) text = withMadeTag(text, tag, true) ?? text;
          const made = parseMadeTags(text).map((tag) => tag.toLowerCase());
          expect(new Set(made).size).toBe(made.length);
          for (const tag of tags) expect(made).toContain(tag);
        },
      ),
    );
  });
});

describe('the tag tree with made tags', () => {
  it('a made tag with no notes is there, counted 0; one notes carry counts them', () => {
    const tree = buildTagTree([{ path: 'a.md', tags: ['draft'] }], ['Draft', 'ideas', 'fic/aot']);
    const byName = Object.fromEntries(tree.map((node) => [node.name, node]));
    expect(byName.draft?.count).toBe(1);
    expect(byName.ideas?.count).toBe(0);
    expect(byName.fic?.count).toBe(0);
    expect(byName.fic?.children[0]?.name).toBe('aot');
  });
});
