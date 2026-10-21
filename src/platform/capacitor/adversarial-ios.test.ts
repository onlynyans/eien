// Adversarial: the phone's storage on iOS, through ./capacitor-files.ts as the
// app runs it there. The plugins are played on Node, each as its iOS code
// does it:
// - Capacitor's Filesystem (@capacitor/filesystem 8.1.5 over
//   ion-ios-filesystem 2.0.1, IONFILEManager.swift): every call first asks
//   FileManager.fileExists, which follows links; readdir then asks each entry
//   for its attributes and fails the whole listing with the first that
//   fails (OS-PLUG-FILE-0008, "… does not exist."); readFile with UTF-8 is
//   String(contentsOf:encoding: .utf8), which refuses a file that isn't
//   well-formed UTF-8 (OS-PLUG-FILE-0013); rename deletes the file at the new
//   name, then moves. Each was run on this Mac against ion-ios-filesystem's
//   own sources, compiled with swiftc.
// - Eien's VaultFiles (ios/App/App/VaultFilesPlugin.swift): a flushed write,
//   renames that replace (rename(2)) or refuse with "TAKEN", a listing of
//   each entry as itself (lstat), links left out, and a save's last step
//   (replace), refused with "CHANGED" when the note moved on meanwhile.
// Each test names what a writer would lose.

import {
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The phone's Documents, and whether Eien's own plugin is there. */
const ios = vi.hoisted(() => ({
  documents: '',
  vaultFiles: true,
  /** Run just before a plugin's rename acts: Syncthing writing beside Eien. */
  beforeRename: null as null | (() => Promise<void>),
  /** Run as a save's last step is coordinated: another app saving the note first. */
  beforeReplace: null as null | (() => Promise<void>),
}));

vi.mock('@capacitor/core', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const full = (at: string) => path.join(ios.documents, at);
  const taken = (at: string) =>
    fs.lstat(full(at)).then(
      () => true,
      () => false,
    );
  const system = (error: unknown) =>
    Object.assign(new Error(`system("${(error as Error).message}")`), { code: undefined });
  const VaultFiles = {
    async write({ path: at, text }: { path: string; text: string }) {
      try {
        const handle = await fs.open(full(at), 'w');
        try {
          await handle.writeFile(text, 'utf8');
          await handle.sync();
        } finally {
          await handle.close();
        }
      } catch (error) {
        throw system(error);
      }
    },
    /** VaultFileOps.list: each entry by lstat, links and the like left out; MISSING with no folder. */
    async list({ path: at }: { path: string }) {
      const folder = full(at);
      const isFolder = await fs.stat(folder).then(
        (entry) => entry.isDirectory(),
        () => false,
      );
      if (!isFolder) throw Object.assign(new Error('Nothing is there.'), { code: 'MISSING' });
      const files = [];
      for (const name of await fs.readdir(folder)) {
        const entry = await fs.lstat(path.join(folder, name)).catch(() => null);
        if (!entry || !(entry.isFile() || entry.isDirectory())) continue;
        files.push({
          name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: entry.isDirectory() ? 0 : entry.size,
          mtime: entry.mtimeMs,
        });
      }
      return { files };
    },
    /** VaultFileOps.replace: other apps save first, then the note's version is looked at. */
    async replace({ from, to, expected }: { from: string; to: string; expected: string | null }) {
      await ios.beforeReplace?.();
      const bytes = await fs.readFile(full(to)).catch(() => null);
      const words = bytes && new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
      const digest = async (text: string) =>
        Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))).toString(
          'hex',
        );
      if ((words === null ? null : await digest(words)) !== expected)
        throw Object.assign(new Error('The note changed meanwhile.'), { code: 'CHANGED' });
      await fs.rename(full(from), full(to)).catch((error) => {
        throw system(error);
      });
    },
    async rename({ from, to, replace }: { from: string; to: string; replace: boolean }) {
      await ios.beforeRename?.();
      if (!replace && (await taken(to)))
        throw Object.assign(new Error('Something is already at that name.'), { code: 'TAKEN' });
      await fs.rename(full(from), full(to)).catch((error) => {
        throw system(error);
      });
    },
  };
  return {
    Capacitor: {
      getPlatform: () => 'ios',
      isPluginAvailable: (name: string) => name !== 'VaultFiles' || ios.vaultFiles,
    },
    registerPlugin: () => VaultFiles,
  };
});

vi.mock('@capacitor/filesystem', async () => {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const full = (at: string) => path.join(ios.documents, at);
  /** FileManager.fileExists(atPath:): follows a link; one to nothing isn't there. */
  const exists = (at: string) =>
    fs.stat(at).then(
      () => true,
      () => false,
    );
  const notFound = (method: string, at: string) =>
    Object.assign(new Error(`'${method}' failed because file at 'file://${at}' does not exist.`), {
      code: 'OS-PLUG-FILE-0008',
    });
  const failed = (method: string, why: string) =>
    Object.assign(new Error(`'${method}' failed with: ${why}`), { code: 'OS-PLUG-FILE-0013' });
  /** attributesOfItem(atPath:): the entry itself, not where a link leads. */
  const attributes = async (at: string) => {
    if (!(await exists(at))) throw notFound('stat', at);
    const entry = await fs.lstat(at);
    return {
      name: path.basename(at),
      type: entry.isDirectory() ? 'directory' : 'file',
      size: entry.size,
      mtime: Math.round(entry.mtimeMs),
      ctime: Math.round(entry.ctimeMs),
      uri: `file://${at}`,
    };
  };
  const Filesystem = {
    async readFile({ path: at, encoding }: { path: string; encoding?: string }) {
      const file = full(at);
      if (!(await exists(file))) throw notFound('readFile', file);
      const bytes = await fs.readFile(file).catch((error: Error) => {
        throw failed('readFile', error.message);
      });
      if (!encoding) return { data: bytes.toString('base64') };
      try {
        // String(contentsOf:encoding: .utf8): a malformed sequence refuses the whole file.
        return { data: new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) };
      } catch {
        throw failed(
          'readFile',
          'The file couldn’t be opened because it isn’t in the correct format.',
        );
      }
    },
    async writeFile({
      path: at,
      data,
      encoding,
    }: {
      path: string;
      data: string;
      encoding?: string;
    }) {
      const file = full(at);
      if (!(await exists(path.dirname(file))))
        throw Object.assign(new Error('Missing parent directory'), { code: 'OS-PLUG-FILE-0011' });
      await fs.writeFile(file, encoding ? data : Buffer.from(data, 'base64')); // never flushed
    },
    stat: ({ path: at }: { path: string }) => attributes(full(at)),
    async readdir({ path: at }: { path: string }) {
      const folder = full(at);
      if (!(await exists(folder))) throw notFound('readdir', folder);
      const files = [];
      for (const name of await fs.readdir(folder)) {
        try {
          files.push(await attributes(path.join(folder, name)));
        } catch {
          throw notFound('readdir', folder); // the listing fails with its first entry that does
        }
      }
      return { files };
    },
    async rename({ from, to }: { from: string; to: string }) {
      const source = full(from);
      const target = full(to);
      if (!(await exists(source))) throw notFound('rename', source);
      if (source === target) return;
      await ios.beforeRename?.();
      // shouldPerformDualPathOperation: a file at the new name is deleted first.
      if ((await exists(target)) && !(await fs.stat(target)).isDirectory()) await fs.rm(target);
      await fs.rename(source, target).catch((error: Error) => {
        throw failed('rename', error.message);
      });
    },
    async mkdir({ path: at }: { path: string }) {
      const folder = full(at);
      if (await exists(folder))
        throw Object.assign(new Error('Directory already exists'), { code: 'OS-PLUG-FILE-0010' });
      await fs.mkdir(folder, { recursive: true });
    },
    async deleteFile({ path: at }: { path: string }) {
      const file = full(at);
      if (!(await exists(file))) throw notFound('deleteFile', file);
      await fs.rm(file, { recursive: true });
    },
  };
  return { Filesystem, Directory: { Documents: 'DOCUMENTS' }, Encoding: { UTF8: 'utf8' } };
});

const { Directory } = await import('@capacitor/filesystem');
const { CapacitorFiles } = await import('./capacitor-files');
const { CapacitorStorage } = await import('./capacitor-storage');
const { recoverStrays } = await import('./recover');

const at = new Date(2026, 9, 19, 16, 40);
let vault: string;

beforeEach(async () => {
  ios.documents = await mkdtemp(join(tmpdir(), 'eien-ios-'));
  ios.vaultFiles = true;
  ios.beforeRename = null;
  ios.beforeReplace = null;
  vault = join(ios.documents, 'Vault');
  await mkdir(vault);
});
afterEach(() => rm(ios.documents, { recursive: true, force: true }));

/** The vault on iOS, as vault-home.ts makes it: 'Vault' in the app's Documents. */
const phone = () => {
  const files = new CapacitorFiles(Directory.Documents, 'Vault');
  return { files, storage: new CapacitorStorage(files) };
};

const put = async (path: string, content: string | Uint8Array) => {
  const full = join(vault, ...path.split('/'));
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, content);
};

/** Every file's bytes as text, anywhere in Documents (hidden ones too); links aren't followed. */
async function everyText(folder = ios.documents): Promise<string[]> {
  const texts: string[] = [];
  for (const name of await readdir(folder)) {
    const path = join(folder, name);
    const entry = await lstat(path);
    if (entry.isDirectory()) texts.push(...(await everyText(path)));
    else if (entry.isFile()) texts.push(await readFile(path, 'utf8'));
  }
  return texts;
}

describe('a listing on iOS', () => {
  it('shows the notes of a folder that also holds a link to nothing', async () => {
    // Syncthing (Möbius Sync) brings the laptop's link "Research -> ~/Dropbox/Research"
    // into the vault; on the phone it leads nowhere. The Filesystem plugin's readdir asks
    // each entry whether it exists, gets no for the link, and fails the whole listing as
    // "does not exist" (OS-PLUG-FILE-0008), which capacitor-files.ts reads as "no folder".
    // Every note in the vault is hidden: the list is empty, and recovery at open walks
    // nothing, so a crash's temp file is never kept before the next save takes its name.
    await put('Chapter.md', 'The first chapter.');
    await put('Fic/Scene.md', 'A scene.');
    await symlink('/Users/writer/Dropbox/Research', join(vault, 'Research'));
    const { files, storage } = phone();
    expect(await stat(vault).then((entry) => entry.isDirectory())).toBe(true);
    expect(await files.list('')).not.toBeNull(); // null means "nothing is there"
    const shown = (await storage.list()).map((entry) => entry.path);
    expect(shown).toContain('Chapter.md');
    expect(shown).toContain('Fic/Scene.md');
  });
});

describe('recovery on iOS', () => {
  it('keeps the words of a temp file a crash cut in the middle of a character', async () => {
    // The phone dies while a save's temp file is being written: what reached the disk ends
    // partway through "—" (three bytes in UTF-8). The Filesystem plugin's UTF-8 read refuses
    // the whole file, so recovery takes it for "can't be read now" and leaves it; the
    // writer opens the chapter (the last save's words) and types, and that save writes
    // the same temp file from the start: the words typed before the crash are gone.
    // The desktop (Node's UTF-8) reads it, the cut character as U+FFFD, and keeps it.
    await put('Chapter.md', 'The last save.');
    const typed = 'The last save. Then a page typed before the phone died — and the rest';
    const bytes = new TextEncoder().encode(typed);
    const cut = bytes.indexOf(0xe2) + 2; // inside "—"
    await put('.Chapter.md.eien.tmp', bytes.slice(0, cut));
    const { files, storage } = phone();
    await recoverStrays(files, storage, at);
    const before = await storage.read('Chapter.md');
    await storage.write('Chapter.md', 'The last save. A new line.', before?.version ?? null);
    expect((await everyText()).join('\n')).toContain('Then a page typed before the phone died');
  });
});

describe('without Eien’s plugin on iOS', () => {
  it('never deletes a note Syncthing brings in at the name a move takes', async () => {
    // When the VaultFiles plugin isn't on the bridge (SceneDelegate.swift shows a plain
    // CAPBridgeViewController, and MainViewController, which registers it, is never made),
    // capacitor-files.ts quietly uses the Filesystem plugin on iOS: renameNew looks, then
    // renames with the plugin that deletes whatever is at the new name first. The laptop's
    // "Chapter.md", arriving after the look, is deleted: no trash, no copy.
    ios.vaultFiles = false;
    await put('Draft.md', 'Mine.');
    ios.beforeRename = async () => {
      ios.beforeRename = null;
      await put('Chapter.md', 'The laptop’s chapter.');
    };
    const { storage } = phone();
    const result = await storage.move('Draft.md', 'Chapter.md').catch(() => null);
    // Refused before any rename (no plugin, nothing written): the chapter arrives all the same.
    await ios.beforeRename?.();
    const texts = await everyText();
    expect(texts).toContain('The laptop’s chapter.');
    expect(texts).toContain('Mine.');
    expect(result?.ok).not.toBe(true);
  });

  it('(the same move, with the plugin there, keeps both: the fakes play it right)', async () => {
    await put('Draft.md', 'Mine.');
    ios.beforeRename = async () => {
      ios.beforeRename = null;
      await put('Chapter.md', 'The laptop’s chapter.');
    };
    const { storage } = phone();
    expect(await storage.move('Draft.md', 'Chapter.md')).toEqual({ ok: false, reason: 'taken' });
    expect(await everyText()).toEqual(expect.arrayContaining(['Mine.', 'The laptop’s chapter.']));
  });
});

describe('another app editing the note in place, through the Files app', () => {
  it('saves its words first; Eien’s save is refused, and keeps the writer’s as a copy', async () => {
    // Without coordination, Eien's save went over the other app's, or the other app's next
    // autosave over Eien's. Now the other app saves as Eien's save is coordinated, and the
    // note's version is looked at after that.
    await put('Shared.md', 'Before.');
    const { storage } = phone();
    const before = await storage.read('Shared.md');
    ios.beforeReplace = async () => {
      ios.beforeReplace = null;
      await put('Shared.md', 'Before. A line typed in the other app.');
    };
    const result = await storage.write(
      'Shared.md',
      'Before. A line typed in Eien.',
      before?.version ?? null,
    );
    expect(result).toEqual({ ok: false, current: await storage.read('Shared.md') });
    expect((await storage.read('Shared.md'))?.text).toBe('Before. A line typed in the other app.');
    // Eien's words are still on the page, and its temp file is gone: the session keeps a copy.
    expect((await readdir(vault)).filter((name) => name.endsWith('.eien.tmp'))).toEqual([]);
  });

  it('a save the other app didn’t touch goes through', async () => {
    await put('Shared.md', 'Before.');
    const { storage } = phone();
    const before = await storage.read('Shared.md');
    const result = await storage.write('Shared.md', 'After.', before?.version ?? null);
    expect(result.ok).toBe(true);
    expect((await storage.read('Shared.md'))?.text).toBe('After.');
  });
});
