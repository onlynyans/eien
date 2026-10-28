// CHANGELOG.md's next section, from main's commit subjects (scripts/changelog.mjs).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { entryOf, notesOf, sectionOf, withSection } from '../scripts/changelog.mjs';
import { buildNumber } from '../scripts/version.mjs';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

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

describe('a release’s notes', () => {
  const CHANGELOG = [
    '# Changelog',
    '',
    '## Unreleased',
    '',
    '- to come',
    '',
    '## 0.10.0 — 2026-12-01',
    '',
    '### Fixes',
    '',
    '- ten (#10)',
    '',
    '## 0.1.0 — 2026-10-22',
    '',
    '### Features',
    '',
    '- first (#1)',
    '',
  ].join('\n');

  it('are the section under its version’s heading, the newest or the last', () => {
    expect(notesOf(CHANGELOG, '0.10.0')).toBe('### Fixes\n\n- ten (#10)\n');
    expect(notesOf(CHANGELOG, '0.1.0')).toBe('### Features\n\n- first (#1)\n');
  });

  it('are nothing for a version with no section, or one only like it', () => {
    for (const version of [
      '0.4.0',
      '0.1',
      '0.1.0.1',
      '0x1.0',
      '0.10',
      'Unreleased'.slice(0, 3),
      '',
    ]) {
      expect(notesOf(CHANGELOG, version), version).toBeNull();
    }
    expect(notesOf('## 0.4.0 — 2026-12-01\n\n', '0.4.0')).toBeNull();
  });
});

describe('CHANGELOG.md', () => {
  const changelog = read('CHANGELOG.md');
  const headings = [...changelog.matchAll(/^## (.*)$/gmu)].map((match) => match[1] ?? '');

  it('names each release by its version and date, newest first, under any Unreleased', () => {
    const releases = headings.filter((heading) => heading !== 'Unreleased');
    expect(headings.indexOf('Unreleased')).toBeLessThanOrEqual(0);
    for (const heading of releases) expect(heading).toMatch(/^\d+\.\d+\.\d+ — \d{4}-\d{2}-\d{2}$/u);
    const numbers = releases.map((heading) => buildNumber(heading.split(' ')[0] ?? ''));
    expect(numbers).toEqual([...numbers].sort((a, b) => b - a));
    expect(releases.at(-1)).toBe('0.1.0 — 2026-10-22');
  });

  it('has a section for every version the release workflow builds', () => {
    // A tag stops at its first check without one, and the draft's notes are that section.
    const release = read('.github/workflows/release.yml');
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the shell's own expansion, as release.yml has it.
    const notes = 'node scripts/changelog.mjs --notes "${GITHUB_REF_NAME#v}"';
    expect(release).toContain(`run: ${notes} > /dev/null`);
    expect(release).toMatch(/--notes-file "\$RUNNER_TEMP\/notes\.md"/u);
    expect(release).not.toContain('--generate-notes');
    expect(release.indexOf(`run: ${notes}`)).toBeLessThan(release.indexOf('run: npm ci'));
  });
});
