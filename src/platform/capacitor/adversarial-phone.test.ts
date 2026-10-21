// Adversarial: the phone's storage (./capacitor-storage.ts) and its recovery
// after a crash (./recover.ts), played on Node's file system as the
// storage's own tests are. Each test holds a rule a writer relies on (spec
// §3: words are never lost, never hidden, never written over) against a
// moment the phone really meets: Syncthing writing beside Eien, two of
// Eien's own calls at once, a long name, a call that fails. A FilesPort
// wrapper picks the moment.
//
// Where a test plays Capacitor's Filesystem plugin itself, it plays what
// @capacitor/filesystem 8.1.5 does on Android (io.ionic.libs:ionfilesystem-
// android 1.1.1, IONFILELocalFilesHelper.renameFile): the target is deleted
// first, then `renameTo`, and if that fails, a copy and a delete.

import { mkdir, mkdtemp, readdir, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renamedPath, utf8Length } from '../../core/paths';
import { CapacitorStorage } from './capacitor-storage';
import type { FilesPort } from './files';
import { filesWith as withCalls } from './files-with';
import { NodeFiles } from './node-files';
import { recoverStrays } from './recover';

const at = new Date(2026, 9, 19, 16, 40);
const OLD = new Date(2026, 0, 1);

let root: string;
let files: NodeFiles;
let storage: CapacitorStorage;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'eien-adv-phone-'));
  files = new NodeFiles(root);
  storage = new CapacitorStorage(files);
});
afterEach(() => rm(root, { recursive: true, force: true }));

const filesWith = (over: Partial<FilesPort>) => withCalls(files, over);

const put = async (path: string, text: string, mtime?: Date) => {
  const full = join(root, ...path.split('/'));
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, text);
  if (mtime) await utimes(full, mtime, mtime);
};

/** Every file's words in the vault's folder: hidden ones, .eien and its trash too. */
async function everyText(folder = root): Promise<string[]> {
  const texts: string[] = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) texts.push(...(await everyText(path)));
    else texts.push(await readFile(path, 'utf8'));
  }
  return texts;
}

/** The notes the vault shows the writer (Storage.list, notes only), with their words. */
async function shownNotes(): Promise<Record<string, string>> {
  const shown: Record<string, string> = {};
  for (const entry of await storage.list()) {
    if (entry.kind === 'note') shown[entry.path] = (await storage.read(entry.path))?.text ?? '';
  }
  return shown;
}

/** The first `count` calls wait for one another, so each has looked before any acts. */
function gate(count: number): () => Promise<void> {
  let arrived = 0;
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived === count) open();
    if (arrived <= count) await opened;
  };
}

describe('move, with something arriving at the new name', () => {
  it('never replaces a note Syncthing brings in at the new name while the move is under way', async () => {
    // The writer renames "Draft" to "Chapter"; in that moment Syncthing brings the other
    // device's "Chapter.md" in. The desktop links (never replacing); the phone checks, then
    // renames over whatever is there: the other device's chapter is gone, in no trash.
    await storage.write('Draft.md', 'mine', null);
    let syncing = true;
    const phone = new CapacitorStorage(
      filesWith({
        makeFolder: async (path) => {
          if (syncing) {
            syncing = false;
            await files.writeText('Chapter.md', 'theirs: a whole chapter');
          }
          await files.makeFolder(path);
        },
      }),
    );
    const result = await phone.move('Draft.md', 'Chapter.md');
    const texts = await everyText();
    expect(texts).toContain('theirs: a whole chapter');
    expect(texts).toContain('mine');
    expect(result.ok ? 'moved' : result.reason).toBe('taken');
  });

  it('never replaces a note Syncthing brings in while recovery puts a step back', async () => {
    // A case-only rename was cut between its steps. At the next open (Syncthing catching up
    // after the phone restarted) the other device's "Tear.md" arrives between recovery's
    // listing and its rename: the rename back replaces it.
    await put('.Tear.md.eien-case', 'The phone’s words.');
    let syncing = true;
    const arriving = filesWith({
      renameNew: async (from, to) => {
        if (syncing) {
          syncing = false;
          await files.writeText('Tear.md', 'The laptop’s words.');
        }
        await files.renameNew(from, to);
      },
    });
    await recoverStrays(arriving, new CapacitorStorage(arriving), at);
    const texts = await everyText();
    expect(texts).toContain('The phone’s words.');
    expect(texts).toContain('The laptop’s words.');
  });

  it('lets only one of two moves to the same new name happen', async () => {
    // Two notes named "Note" moved into one folder at once. Moves wait only for others of the
    // same source, so both see the name free and both rename onto it: the first note's words
    // are replaced by the second's, and nothing says so. (The window runs its own file
    // operations one at a time, so this holds the Storage contract, not today's window.)
    await storage.write('A/Note.md', 'from A', null);
    await storage.write('B/Note.md', 'from B', null);
    const bothLooked = gate(2);
    const phone = new CapacitorStorage(
      filesWith({
        makeFolder: async (path) => {
          await bothLooked();
          await files.makeFolder(path);
        },
      }),
    );
    const results = await Promise.all([
      phone.move('A/Note.md', 'C/Note.md'),
      phone.move('B/Note.md', 'C/Note.md'),
    ]);
    const texts = await everyText();
    expect(texts).toContain('from A');
    expect(texts).toContain('from B');
    expect(results.filter((result) => !result.ok)).toHaveLength(1);
  });
});

describe('trash', () => {
  it('keeps both of two notes of one name trashed in the same moment', async () => {
    // "A/Note.md" and "B/Note.md" trashed together: both pick .eien/trash/<moment>/Note.md
    // (each looked before the other moved in), and the second rename replaces the first.
    // The first note is in no trash and nowhere else. (As above: the contract, not today's
    // window, which trashes one thing at a time.)
    const moment = Date.UTC(2026, 9, 20, 22, 40);
    await storage.write('A/Note.md', 'the first note', null);
    await storage.write('B/Note.md', 'the second note', null);
    const bothLooked = gate(2);
    const phone = new CapacitorStorage(
      filesWith({
        makeFolder: async (path) => {
          await bothLooked();
          await files.makeFolder(path);
        },
      }),
      { now: () => moment },
    );
    await Promise.all([phone.trash('A/Note.md'), phone.trash('B/Note.md')]);
    const trashed = await everyText(join(root, '.eien', 'trash'));
    expect(trashed).toContain('the first note');
    expect(trashed).toContain('the second note');
  });
});

describe('a case-only rename', () => {
  it('renames a note whose title is the longest the rename allows', async () => {
    // renamedPath leaves 10 bytes for ".<name>.eien.tmp"; the step's ".<name>.eien-case" takes
    // 11, so the step's name is 256 bytes and the file system refuses it (ENAMETOOLONG). The
    // desktop renames such a note; the phone throws, and the title can't be fixed.
    const long = renamedPath('Note.md', 'a'.repeat(300), [], true);
    if (!long.ok) throw new Error('refused');
    expect(utf8Length(long.path)).toBe(245);
    await storage.write(long.path, 'Words.', null);
    const capital = `A${long.path.slice(1)}`;
    expect(await storage.move(long.path, capital)).toEqual({ ok: true });
    expect((await storage.read(capital))?.text).toBe('Words.');
  });

  it('never writes over a step an earlier crash left, renaming the same note again', async () => {
    // A rename cut between its steps left ".Tear.md.eien-case", and the open couldn't put it
    // back ("left for the next open", recover.ts). "Tear.md" has been written since. Renaming
    // it "tear.md" takes the same step name, and the rename replaces what's there: the first
    // words, kept only in the step, are gone before the next open can recover them.
    await put('.Tear.md.eien-case', 'The first words.');
    await put('Tear.md', 'Written since.');
    await storage.move('Tear.md', 'tear.md');
    const texts = await everyText();
    expect(texts).toContain('The first words.');
    expect(texts).toContain('Written since.');
  });

  it('leaves a book in the vault when its second step fails while the app runs', async () => {
    // "fic" renamed "Fic". Between the steps Syncthing writes into "Fic" (making it again);
    // on Android the second step then refuses (DestinationDirectoryExists), and every chapter
    // stays under the hidden ".fic.eien-case" for as long as the app runs: the book looks
    // emptied. The trash puts back what it stepped aside when it fails; the move doesn't.
    await storage.write('fic/One.md', 'Chapter one.', null);
    await storage.write('fic/Two.md', 'Chapter two.', null);
    let renames = 0;
    const phone = new CapacitorStorage(
      filesWith({
        renameNew: async (from, to) => {
          renames += 1;
          if (renames === 2) throw new Error('DestinationDirectoryExists: Fic');
          await files.renameNew(from, to);
        },
      }),
    );
    await expect(phone.move('fic', 'Fic')).rejects.toThrow();
    const shown = Object.values(await shownNotes());
    expect(shown).toContain('Chapter one.');
    expect(shown).toContain('Chapter two.');
  });
});

describe('a save on Android, where a failed rename has deleted the note', () => {
  it('keeps the words when the rename over the note fails', async () => {
    // The plugin's rename deletes the note first, then renames the temp file onto it; when
    // that fails (and the copy it falls back on fails: a full disk) it throws. The storage
    // then removes the temp file, "never the note" — but the note is already gone. Both the
    // old words and the new ones are lost.
    await storage.write('Note.md', 'Old words.', null);
    const before = await storage.read('Note.md');
    const android = new CapacitorStorage(
      filesWith({
        rename: async (_from, to) => {
          await files.remove(to).catch(() => undefined); // dst.delete()
          throw new Error('UnknownError: renameTo failed, and the copy (no space left)');
        },
      }),
    );
    await expect(android.write('Note.md', 'New words.', before?.version ?? null)).rejects.toThrow();
    const texts = await everyText();
    expect(texts.some((text) => text === 'Old words.' || text === 'New words.')).toBe(true);
  });
});

describe('recovery after a crash', () => {
  it('recovers a long-titled note’s save as a note the vault shows', async () => {
    // A note whose name is past 245 bytes saves through ".<cut>~<hash>.eien.tmp". The phone
    // dies before the rename. recoveredName now keeps the name's own extension, and the cut
    // name has none: the words come back as "<cut>~<hash> (recovered …)", without ".md" —
    // not a note, so Eien never shows it.
    const long = `${'a'.repeat(246)}.md`;
    await put(long, 'Old words.', OLD);
    const before = await storage.read(long);
    const dying = new CapacitorStorage(
      filesWith({ rename: () => new Promise<void>(() => undefined) }), // the phone dies here
    );
    void dying.write(long, 'Old words. And the new paragraph.', before?.version ?? null);
    await expect
      .poll(async () => (await readdir(root)).some((name) => name.endsWith('.eien.tmp')))
      .toBe(true);
    await recoverStrays(files, storage, at);
    expect(Object.values(await shownNotes())).toContain('Old words. And the new paragraph.');
  });

  it('never removes a temp file whose words it couldn’t read', async () => {
    // A read that fails just now (an I/O error, a file too big for the bridge) is taken as
    // an empty temp file, and an empty one is removed: the only copy of the words, gone
    // unread. A temp it can't keep yet is left for next time; one it can't read should be too.
    await put('.Draft.md.eien.tmp', 'Words with nowhere else.');
    const shaky = filesWith({
      readText: async (path) => {
        if (path.endsWith('.eien.tmp')) throw new Error('EIO: i/o error');
        return files.readText(path);
      },
    });
    await recoverStrays(shaky, new CapacitorStorage(shaky), at);
    expect(await everyText()).toContain('Words with nowhere else.');
  });

  it('keeps words the phone was saving when another device’s later edit synced in meanwhile', async () => {
    // The phone dies mid-save (its temp file holds the paragraph written on the bus). The
    // writer carries on at the laptop; Syncthing brings that edit in, with the laptop's own,
    // later time. At the next open the temp is older than its note, so it's removed: the
    // paragraph is in no note, no conflict copy, nowhere. (spec §3 keeps only a temp file
    // "newer than its note".)
    await put('Note.md', 'Before the bus.', OLD);
    await put(
      '.Note.md.eien.tmp',
      'Before the bus. The paragraph written on the bus.',
      new Date(2026, 9, 19, 9, 0),
    );
    await put('Note.md', 'Before the bus. Then the laptop.', new Date(2026, 9, 19, 12, 0));
    await recoverStrays(files, storage, at);
    expect(await everyText()).toContain('Before the bus. The paragraph written on the bus.');
  });
});
