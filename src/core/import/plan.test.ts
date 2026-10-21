import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { baseName, nameKey, nameProblems, parentOf } from '../paths';
import { MAX_IMPORT_NOTES, noteTitle, planImport, type SourceFile } from './plan';

const MB8 = 8 * 1024 * 1024;
const files = (...paths: string[]): SourceFile[] => paths.map((path) => ({ path, size: 10 }));

describe('noteTitle', () => {
  it('knows a note elsewhere by its extension, case aside', () => {
    expect(noteTitle('Ideas.md')).toBe('Ideas');
    expect(noteTitle('Ideas.MARKDOWN')).toBe('Ideas');
    expect(noteTitle('a.b.mdown')).toBe('a.b');
    expect(noteTitle('Draft.mkd')).toBe('Draft');
    expect(noteTitle('Old.txt')).toBe('Old');
    expect(noteTitle('.md')).toBeNull();
    expect(noteTitle('photo.png')).toBeNull();
    expect(noteTitle('notes.md.bak')).toBeNull();
  });
});

describe('planImport', () => {
  it('copies notes into a new folder named for the one chosen, as ".md", folders and all', () => {
    const plan = planImport(files('A.md', 'Sub/B.markdown', 'Sub/Deeper/C.txt'), 'Drafts', [], MB8);
    expect(plan.folder).toBe('Drafts');
    expect(plan.copies).toEqual([
      { from: 'A.md', to: 'Drafts/A.md' },
      { from: 'Sub/B.markdown', to: 'Drafts/Sub/B.md' },
      { from: 'Sub/Deeper/C.txt', to: 'Drafts/Sub/Deeper/C.md' },
    ]);
    expect(plan.left).toEqual([]);
  });

  it('numbers its folder when the vault has one by that name, case aside', () => {
    expect(planImport([], 'Drafts', ['drafts', 'Drafts 2'], MB8).folder).toBe('Drafts 3');
    expect(planImport([], 'Notes', ['Notes.md'], MB8).folder).toBe('Notes');
  });

  it('gives a second name one system would take for the first a number', () => {
    const plan = planImport(
      files('notes.md', 'Notes.md', 'Notes.txt', 'Café.md', 'Café.md'),
      'F',
      [],
      MB8,
    );
    expect(plan.copies.map((copy) => copy.to)).toEqual([
      'F/Café.md',
      'F/Café 2.md',
      'F/Notes.md',
      'F/Notes 2.md',
      'F/notes 3.md',
    ]);
  });

  it('numbers a folder another folder’s name takes, case aside, and keeps their notes apart', () => {
    const plan = planImport(files('Part/A.md', 'part/A.md'), 'F', [], MB8);
    expect(plan.copies.map((copy) => copy.to)).toEqual(['F/Part/A.md', 'F/part 2/A.md']);
  });

  it('leaves out what isn’t a note, what’s too big, and names some system can’t hold', () => {
    const plan = planImport(
      [
        { path: 'photo.png', size: 1 },
        { path: 'Big.md', size: MB8 + 1 },
        { path: 'Fits.md', size: MB8 },
        { path: 'CON.md', size: 1 },
        { path: 'a:b.md', size: 1 },
        { path: 'Trailing. /x.md', size: 1 },
        { path: 'aux/x.md', size: 1 },
      ],
      'F',
      [],
      MB8,
    );
    expect(plan.copies.map((copy) => copy.from)).toEqual(['Fits.md']);
    expect(plan.left).toEqual([
      { path: 'Big.md', reason: 'too-large' },
      { path: 'CON.md', reason: 'bad-name' },
      { path: 'Trailing. /x.md', reason: 'bad-name' },
      { path: 'a:b.md', reason: 'bad-name' },
      { path: 'aux/x.md', reason: 'bad-name' },
      { path: 'photo.png', reason: 'not-a-note' },
    ]);
  });

  it('leaves hidden files and folders out without a word', () => {
    const plan = planImport(
      files('.obsidian/app.md', '.DS_Store', 'a/.hidden.md', 'Seen.md'),
      'F',
      [],
      MB8,
    );
    expect(plan.copies.map((copy) => copy.from)).toEqual(['Seen.md']);
    expect(plan.left).toEqual([]);
  });

  it(`brings at most ${MAX_IMPORT_NOTES} notes, and says the rest were left`, () => {
    const many = Array.from({ length: MAX_IMPORT_NOTES + 2 }, (_, i) => ({
      path: `n${String(i).padStart(5, '0')}.md`,
      size: 1,
    }));
    const plan = planImport(many, 'F', [], MB8);
    expect(plan.copies).toHaveLength(MAX_IMPORT_NOTES);
    expect(plan.left).toEqual([
      { path: 'n10000.md', reason: 'too-many' },
      { path: 'n10001.md', reason: 'too-many' },
    ]);
  });

  it('never gives two copies one name, takes every file or says why, and names only what every system holds', () => {
    const name = fc.constantFrom(
      'a',
      'A',
      'b',
      'Café',
      'Café',
      'STRASSE',
      'Straße',
      'CON',
      'x:y',
      'n ',
      '.h',
    );
    const extension = fc.constantFrom('.md', '.MD', '.txt', '.markdown', '.png', '');
    const path = fc
      .tuple(fc.array(name, { maxLength: 2 }), name, extension)
      .map(([folders, base, ext]) => [...folders, base + ext].join('/'));
    fc.assert(
      fc.property(
        fc.uniqueArray(path, { maxLength: 12 }),
        fc.array(name, { maxLength: 3 }),
        (paths, vault) => {
          const plan = planImport(files(...paths), 'Import', vault, MB8);
          expect(vault.map(nameKey)).not.toContain(nameKey(plan.folder));
          const targets = plan.copies.map((copy) => copy.to);
          expect(new Set(targets.map(nameKey)).size).toBe(targets.length);
          for (const target of targets) {
            expect(target.startsWith(`${plan.folder}/`)).toBe(true);
            expect(target.endsWith('.md')).toBe(true);
            for (const part of target.split('/')) expect(nameProblems(part), target).toEqual([]);
          }
          // A note and a folder beside it never share a name either.
          const folders = new Set(targets.map(parentOf));
          for (const target of targets) {
            const sibling = `${parentOf(target)}/${baseName(target)}`;
            expect([...folders].map(nameKey)).not.toContain(nameKey(sibling));
          }
          const accounted = [
            ...plan.copies.map((copy) => copy.from),
            ...plan.left.map((l) => l.path),
          ];
          const visible = paths.filter((p) => !p.split('/').some((part) => part.startsWith('.')));
          expect(accounted.sort()).toEqual(visible.sort());
        },
      ),
    );
  });
});
