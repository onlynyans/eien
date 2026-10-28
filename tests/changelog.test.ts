// CHANGELOG.md's next section, from main's commit subjects (scripts/changelog.mjs).

import { describe, expect, it } from 'vitest';
import { entryOf, sectionOf, withSection } from '../scripts/changelog.mjs';

describe('a changelog entry', () => {
  it('names the scope, the words and the pull request', () => {
    expect(entryOf('feat(epub): a page holds a note or an EPUB (#101)')).toEqual({
      group: 'Features',
      line: '- **epub:** a page holds a note or an EPUB (#101)',
    });
    expect(entryOf('fix: the sync icon level (#96)')).toEqual({
      group: 'Fixes',
      line: '- the sync icon level (#96)',
    });
  });

  it('marks a change that breaks a vault’s files or settings', () => {
    expect(entryOf('feat(settings)!: one file for the faces (#130)').line).toBe(
      '- **Breaking:** **settings:** one file for the faces (#130)',
    );
  });

  it('keeps a subject that isn’t conventional as written, in Other', () => {
    expect(entryOf('Merge pull request #70 from onlynyans/claude/phone-other')).toEqual({
      group: 'Other',
      line: '- Merge pull request #70 from onlynyans/claude/phone-other',
    });
  });
});

describe('a release’s section', () => {
  it('groups Features, Fixes and Other, each oldest first', () => {
    const subjects = [
      'docs(epub): three motions for turning the page (#97)',
      'fix(editor): the caret stays in a cell (#102)',
      'feat(epub): open an EPUB on a page (#103)',
      'perf(list): draw only the rows in sight (#104)',
      'feat(phone): the EPUB on a phone (#105)',
      'refactor: one cleaner (#100)',
      'Facing pages: the split as one book',
      'test: the cleaner’s adversarial pages (#106)',
      'ci: the title check (#107)',
      'build: one version (#108)',
      'chore: tidy the backlog (#109)',
    ];
    expect(sectionOf(subjects, '0.5.0 — 2026-11-02')).toBe(
      [
        '## 0.5.0 — 2026-11-02',
        '',
        '### Features',
        '',
        '- **epub:** open an EPUB on a page (#103)',
        '- **phone:** the EPUB on a phone (#105)',
        '',
        '### Fixes',
        '',
        '- **editor:** the caret stays in a cell (#102)',
        '',
        '### Other',
        '',
        '- **epub:** three motions for turning the page (#97)',
        '- **list:** draw only the rows in sight (#104)',
        '- one cleaner (#100)',
        '- Facing pages: the split as one book',
        '- the cleaner’s adversarial pages (#106)',
        '- the title check (#107)',
        '- one version (#108)',
        '- tidy the backlog (#109)',
        '',
      ].join('\n'),
    );
  });

  it('leaves out a group with nothing in it', () => {
    const section = sectionOf(['fix: one (#1)'], 'Unreleased');
    expect(section).toBe('## Unreleased\n\n### Fixes\n\n- one (#1)\n');
  });

  it('says so when nothing has changed', () => {
    expect(sectionOf([], 'Unreleased')).toBe('## Unreleased\n\nNothing since the last release.\n');
  });
});

describe('the changelog with a new section', () => {
  const INTRO = '# Changelog\n\nWhat changed.\n\n';
  const NEW = '## 0.5.0 — 2026-11-02\n\n### Fixes\n\n- one (#1)\n';

  it('takes the Unreleased section’s place', () => {
    const before = `${INTRO}## Unreleased\n\n- by hand\n\n## 0.4.0 — 2026-10-27\n\n- old\n`;
    expect(withSection(before, NEW)).toBe(`${INTRO}${NEW}\n## 0.4.0 — 2026-10-27\n\n- old\n`);
  });

  it('takes the place of an Unreleased section at the end', () => {
    expect(withSection(`${INTRO}## Unreleased\n\n- by hand\n`, NEW)).toBe(`${INTRO}${NEW}\n`);
  });

  it('goes above the newest release, keeping every older one', () => {
    const before = `${INTRO}## 0.4.0 — 2026-10-27\n\n- old\n\n## 0.1.0 — 2026-10-22\n\n- first\n`;
    expect(withSection(before, NEW)).toBe(
      `${INTRO}${NEW}\n## 0.4.0 — 2026-10-27\n\n- old\n\n## 0.1.0 — 2026-10-22\n\n- first\n`,
    );
  });

  it('starts the list in a changelog with no release yet', () => {
    expect(withSection('# Changelog\n', NEW)).toBe(`# Changelog\n\n${NEW}`);
  });
});
