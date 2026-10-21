// The phone's recovery after a crash (./recover.ts): every case the desktop's
// recover-strays covers, and the phone's own two-step renames cut between
// their steps — played on Node's file system, as the phone storage's tests are.

import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CapacitorStorage } from './capacitor-storage';
import type { FilesPort } from './files';
import { filesWith as withCalls } from './files-with';
import { NodeFiles } from './node-files';
import { recoverStrays } from './recover';

const at = new Date(2026, 9, 19, 16, 40);
const STAMP = '(recovered 2026-10-19 16-40)';
const OLD = new Date(2026, 0, 1);

let root: string;
let files: NodeFiles;
let storage: CapacitorStorage;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'eien-recover-'));
  files = new NodeFiles(root);
  storage = new CapacitorStorage(files);
});
afterEach(() => rm(root, { recursive: true, force: true }));

const put = async (path: string, text: string, mtime?: Date) => {
  const full = join(root, ...path.split('/'));
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, text);
  if (mtime) await utimes(full, mtime, mtime);
};
const filesWith = (over: Partial<FilesPort>) => withCalls(files, over);
const text = (path: string) => readFile(join(root, ...path.split('/')), 'utf8');
const names = async (folder = '') => (await readdir(join(root, folder))).sort();

describe('a new file’s write cut short (an import’s image)', () => {
  it('is removed: what it held is still where it was copied from', async () => {
    await put('Art/.scarf.png.eien-new', 'PNG');
    expect(await recoverStrays(files, storage)).toEqual([]);
    expect(await files.list('Art')).toEqual([]);
  });

  it('never goes over a file that arrived while its bytes went in', async () => {
    const racing = new CapacitorStorage(
      filesWith({
        writeBytes: async (path, bytes) => {
          await put('Art/scarf.png', 'theirs'); // Syncthing, a moment after the check
          await files.writeBytes(path, bytes);
        },
      }),
    );
    expect(await racing.writeNew('Art/scarf.png', new Uint8Array([1]))).toBe(false);
    expect(await text('Art/scarf.png')).toBe('theirs');
    expect((await files.list('Art'))?.map((entry) => entry.name)).toEqual(['scarf.png']);
  });
});

describe('a write cut short', () => {
  it('keeps a temp file’s newer words beside its note, and the note as it was', async () => {
    await put('Seventeen.md', 'Old words.', OLD);
    await put('.Seventeen.md.eien.tmp', 'Newer words, not yet renamed.');
    expect(await recoverStrays(files, storage, at)).toEqual([`Seventeen ${STAMP}.md`]);
    expect(await text(`Seventeen ${STAMP}.md`)).toBe('Newer words, not yet renamed.');
    expect(await text('Seventeen.md')).toBe('Old words.');
    expect(await names()).toEqual(['Seventeen (recovered 2026-10-19 16-40).md', 'Seventeen.md']);
  });

  it('keeps a temp file whose note is gone, in a folder', async () => {
    await put('Fic/.Lost.md.eien.tmp', 'Only copy.');
    expect(await recoverStrays(files, storage, at)).toEqual([`Fic/Lost ${STAMP}.md`]);
    expect(await text(`Fic/Lost ${STAMP}.md`)).toBe('Only copy.');
  });

  it('drops one holding its note’s own words, or none', async () => {
    await put('Same.md', 'Same.', OLD);
    await put('.Same.md.eien.tmp', 'Same.');
    await put('.Empty.md.eien.tmp', '');
    expect(await recoverStrays(files, storage, at)).toEqual([]);
    expect(await names()).toEqual(['Same.md']);
  });

  it('keeps one older than its note when its words are other', async () => {
    // Its note was changed since by another device (this one's next save would have taken the
    // same temp file): the temp's words are nowhere else.
    await put('Old.md', 'Current.');
    await put('.Old.md.eien.tmp', 'Older draft.', OLD);
    expect(await recoverStrays(files, storage, at)).toEqual([`Old ${STAMP}.md`]);
    expect(await text(`Old ${STAMP}.md`)).toBe('Older draft.');
  });

  it('leaves hidden folders alone, and a name that only looks like a temp', async () => {
    await put('.git/.x.md.eien.tmp', 'not ours');
    await put('.eien.tmp', 'a file named only the suffix');
    expect(await recoverStrays(files, storage, at)).toEqual([]);
    expect(await names('.git')).toEqual(['.x.md.eien.tmp']);
    expect(await names()).toContain('.eien.tmp');
  });

  it('keeps a hidden file’s words hidden', async () => {
    // A folder's settings cut short: shown as a note, the app's JSON would sit among the chapters.
    await put('Fic/.eien-folder.json', '{"book":{}}', OLD);
    await put('Fic/..eien-folder.json.eien.tmp', '{"book":{"goal":5000}}');
    expect(await recoverStrays(files, storage, at)).toEqual([`Fic/.eien-folder ${STAMP}.json`]);
    expect((await storage.list()).map((entry) => entry.path)).toEqual(['Fic']);
  });

  it('leaves the temp when its words can’t be kept yet', async () => {
    const refusing = filesWith({
      writeText: async () => {
        throw new Error('The disk is full.');
      },
    });
    await put('.Draft.md.eien.tmp', 'Words with nowhere else.');
    const shaky = new CapacitorStorage(refusing);
    expect(await recoverStrays(refusing, shaky, at)).toEqual([]);
    expect(await text('.Draft.md.eien.tmp')).toBe('Words with nowhere else.');
  });
});

describe('a rename cut between its steps', () => {
  it('puts a note back under its name', async () => {
    await put('Fic/.Tear.md.eien-case', 'The scarf tore.');
    expect(await recoverStrays(files, storage, at)).toEqual(['Fic/Tear.md']);
    expect(await text('Fic/Tear.md')).toBe('The scarf tore.');
    expect(await names('Fic')).toEqual(['Tear.md']);
  });

  it('puts it beside a note now under its name, by any case', async () => {
    await put('.Tear.md.eien-case', 'The first words.');
    await put('tear.md', 'Written since.');
    expect(await recoverStrays(files, storage, at)).toEqual([`Tear ${STAMP}.md`]);
    expect(await text(`Tear ${STAMP}.md`)).toBe('The first words.');
    expect(await text('tear.md')).toBe('Written since.');
  });

  it('puts a folder back, and recovers what’s inside it', async () => {
    await put('.Scarf.eien-case/Tear.md', 'Kept.');
    await put('.Scarf.eien-case/.Mend.md.eien.tmp', 'Mended, never renamed.');
    expect(await recoverStrays(files, storage, at)).toEqual(['Scarf', `Scarf/Mend ${STAMP}.md`]);
    expect(await names('Scarf')).toEqual([`Mend ${STAMP}.md`, 'Tear.md']);
  });

  it('puts .eien back after a trash cut short, hidden', async () => {
    await put('..eien.eien-trashing/settings.json', '{}');
    expect(await recoverStrays(files, storage, at)).toEqual(['.eien']);
    expect(await text('.eien/settings.json')).toBe('{}');
  });

  it('keeps the old .eien hidden beside a new one', async () => {
    await put('..eien.eien-trashing/versions/a/1.md', 'An old version.');
    await put('.eien/trash/x', '');
    expect(await recoverStrays(files, storage, at)).toEqual([`.eien ${STAMP}`]);
    expect(await text(`.eien ${STAMP}/versions/a/1.md`)).toBe('An old version.');
    expect((await storage.list()).map((entry) => entry.path)).toEqual([]);
  });

  it('leaves names that only look like a step', async () => {
    await put('x.eien-case', 'visible, not a step');
    await put('.eien-case', 'only the suffix');
    expect(await recoverStrays(files, storage, at)).toEqual([]);
    expect(await names()).toEqual(['.eien-case', 'x.eien-case']);
  });

  it('a case-only rename that crashes between its steps loses nothing', async () => {
    // The phone dies after the note took its step's name: the note is hidden from the vault
    // (its name starts with a dot) until the next open puts it back.
    await storage.write('Fic/tear.md', 'The scarf tore.', null);
    let renames = 0;
    const dying = filesWith({
      renameNew: async (from: string, to: string) => {
        renames += 1;
        if (renames === 2) return new Promise<void>(() => undefined); // the phone dies here
        return files.renameNew(from, to);
      },
    });
    void new CapacitorStorage(dying).move('Fic/tear.md', 'Fic/Tear.md');
    await expect.poll(() => names('Fic')).toEqual(['.tear.md.eien-case']);
    expect((await storage.list()).map((entry) => entry.path)).toEqual(['Fic']);
    expect(await recoverStrays(files, storage, at)).toEqual(['Fic/tear.md']);
    expect((await storage.read('Fic/tear.md'))?.text).toBe('The scarf tore.');
  });

  it('a second step that fails puts the first back, while the app runs', async () => {
    await storage.write('Fic/tear.md', 'The scarf tore.', null);
    let renames = 0;
    const refusing = filesWith({
      renameNew: async (from: string, to: string) => {
        renames += 1;
        if (renames === 2) throw new Error('The disk is busy.');
        return files.renameNew(from, to);
      },
    });
    await expect(
      new CapacitorStorage(refusing).move('Fic/tear.md', 'Fic/Tear.md'),
    ).rejects.toThrow();
    expect(await names('Fic')).toEqual(['tear.md']);
  });

  it('a step it can’t move back is left for the next open', async () => {
    await put('.Tear.md.eien-case', 'Words.');
    const stuck = filesWith({
      renameNew: async () => {
        throw new Error('Busy.');
      },
    });
    expect(await recoverStrays(stuck, storage, at)).toEqual([]);
    expect(await names()).toEqual(['.Tear.md.eien-case']);
    expect(await recoverStrays(files, storage, at)).toEqual(['Tear.md']);
  });
});
