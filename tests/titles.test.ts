// A pull request's title becomes main's commit subject, and the changelog is
// read from those (scripts/titles.mjs, CI's "Pull request title" check).

import { describe, expect, it } from 'vitest';
import { readTitle } from '../scripts/titles.mjs';

describe('a pull request’s title', () => {
  it('reads type, scope, a break and the subject', () => {
    expect(readTitle('feat(epub): a page holds a note or an EPUB')).toEqual({
      ok: true,
      title: {
        type: 'feat',
        scope: 'epub',
        breaking: false,
        subject: 'a page holds a note or an EPUB',
        pr: null,
      },
    });
    expect(readTitle('fix!: front matter keeps its order (#120)')).toEqual({
      ok: true,
      title: {
        type: 'fix',
        scope: null,
        breaking: true,
        subject: 'front matter keeps its order',
        pr: 120,
      },
    });
    expect(readTitle('refactor(split-sheets)!: one divider (#7)').ok).toBe(true);
  });

  it('takes every type the changelog knows', () => {
    for (const type of [
      'feat',
      'fix',
      'refactor',
      'perf',
      'docs',
      'test',
      'ci',
      'build',
      'chore',
    ]) {
      expect(readTitle(`${type}: words`).ok, type).toBe(true);
    }
  });

  it('keeps a name in capitals at the subject’s start', () => {
    expect(readTitle('feat(extension): AO3’s series pages').ok).toBe(true);
    expect(readTitle('fix(export): EPUB covers keep their size').ok).toBe(true);
    expect(readTitle('fix(editor): ⌘S seals in Live').ok).toBe(true);
    expect(readTitle('fix: macOS’s lights stay put').ok).toBe(true);
  });

  it('refuses what isn’t conventional, saying why', () => {
    const problems = [
      'A page holds a note or an EPUB (#101)',
      'feature(epub): a page',
      'Feat: words',
      'feat(EPUB): words',
      'feat(two words): words',
      'feat(epub):words',
      'feat(epub):  words',
      'feat(epub): ',
      'feat(epub): A page holds a note',
      'feat(epub): a page holds a note.',
      'feat (epub): words',
    ];
    for (const title of problems) {
      const read = readTitle(title);
      expect(read.ok, title).toBe(false);
      if (!read.ok) expect(read.problem.length, title).toBeGreaterThan(0);
    }
  });
});
