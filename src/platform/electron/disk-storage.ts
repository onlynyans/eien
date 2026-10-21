// A vault on disk, for the Electron main process (spec §3: durable writes,
// paths kept inside the vault, a watcher).

import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { lstat, mkdir, readdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { isHiddenName, nameKey, VaultPathError, vaultPath } from '../../core/paths';
import { kindOf, type VaultEntry } from '../../core/vault';
import { type CaseLook, caseTwin, twinError } from '../case-twin';
import {
  type FileState,
  MAX_BYTES_READ,
  type MoveResult,
  type Storage,
  type WriteResult,
} from '../storage';
import { hiddenBeside, NEW_SUFFIX } from '../stray';
import { watchFolder } from './disk-watch';
import {
  linkInstead,
  renameWithRetry,
  syncFolder,
  writeDurably,
  writeFlushed,
} from './disk-writes';

export { writeDurably } from './disk-writes';

/** Sends a file or folder (an absolute path) to the system's trash; throws when it can't. */
export type TrashItem = (path: string) => Promise<void>;

const noTrash: TrashItem = async () => {
  throw new Error('There is no trash to send it to on this system.');
};

export class DiskStorage implements Storage {
  readonly #root: string;
  readonly #trashItem: TrashItem;
  /** The write under way for each file, by its name key, so the next waits for it. */
  readonly #writing = new Map<string, Promise<void>>();

  /**
   * `root` must be a real, absolute folder path (see `openDiskStorage`).
   * `trashItem` is the system's trash (Electron's, in the app).
   */
  constructor(root: string, trashItem: TrashItem = noTrash) {
    this.#root = root;
    this.#trashItem = trashItem;
  }

  get root(): string {
    return this.#root;
  }

  /** The disk's own rule for case: macOS's and Windows's ignore it, Linux's tells it apart. */
  readonly #look: CaseLook = {
    exists: async (path) => (await lstat(this.#file(path)).catch(() => null)) !== null,
    names: (folder) => readdir(this.#file(folder)).catch(() => []),
  };

  /** The absolute path of a vault path that's been through vaultPath. */
  #file(path: string): string {
    return join(this.#root, ...path.split('/'));
  }

  async listFiles(folder: string): Promise<string[]> {
    const at = folder === '' ? this.#root : await this.#resolve(folder);
    const names = await readdir(at, { withFileTypes: true }).catch(() => [] as Dirent[]);
    const addressable = (name: string) => {
      try {
        vaultPath(folder ? `${folder}/${name}` : name);
        return true;
      } catch {
        return false; // a name Eien can't read back on every system, as list() leaves out
      }
    };
    return names
      .filter((dirent) => dirent.isFile() && !isHiddenName(dirent.name) && addressable(dirent.name))
      .map((dirent) => dirent.name);
  }

  async list(): Promise<VaultEntry[]> {
    const entries: VaultEntry[] = [];
    const walk = async (folder: string): Promise<void> => {
      let names: Dirent[];
      try {
        names = await readdir(join(this.#root, folder), { withFileTypes: true });
      } catch {
        return; // gone or unreadable meanwhile: list what can be read
      }
      for (const dirent of names) {
        if (isHiddenName(dirent.name) || dirent.isSymbolicLink()) continue;
        const path = folder ? `${folder}/${dirent.name}` : dirent.name;
        try {
          vaultPath(path);
        } catch {
          continue; // a name Eien can't address on every system: left alone, not listed
        }
        if (dirent.isDirectory()) {
          entries.push({ path, kind: 'folder', modified: 0, size: 0 });
          await walk(path);
        } else if (dirent.isFile()) {
          const stats = await lstat(join(this.#root, path)).catch(() => null);
          if (!stats) continue;
          entries.push({
            path,
            kind: kindOf(dirent.name, false),
            modified: stats.mtimeMs,
            size: stats.size,
          });
        }
      }
    };
    await walk('');
    return entries;
  }

  async read(path: string): Promise<FileState | null> {
    return this.#readFile(await this.#resolve(path));
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const file = await this.#resolve(path);
    const stats = await stat(file).catch(() => null);
    if (!stats?.isFile() || stats.size > MAX_BYTES_READ) return null;
    return new Uint8Array(await readFile(file));
  }

  /**
   * Writes to one file run one at a time, so two can't both pass the
   * version check. The version is checked again just before the new text
   * takes the file's place, so a change another program makes while the
   * text is flushed to disk is refused, not overwritten.
   */
  async write(path: string, text: string, expected: string | null): Promise<WriteResult> {
    const file = await this.#resolve(path);
    return this.#oneAtATime(nameKey(vaultPath(path)), async () => {
      const current = await this.#readFile(file);
      if ((current?.version ?? null) !== expected) return { ok: false, current };
      const twin = current === null ? await caseTwin(this.#look, vaultPath(path)) : null;
      if (twin !== null) return { ok: false, current: await this.#readFile(this.#file(twin)) };
      await mkdir(dirname(file), { recursive: true });
      let changed: FileState | null = null;
      const written = await writeDurably(file, text, async () => {
        const now = await this.#readFile(file);
        if ((now?.version ?? null) === expected) return true;
        changed = now;
        return false;
      });
      return written ? { ok: true, version: versionOf(text) } : { ok: false, current: changed };
    });
  }

  /**
   * Through a hidden temp file, flushed, then given the name with a link,
   * which fails if anything is there (on a disk without links, looked at once
   * more just before the rename).
   */
  async writeNew(path: string, bytes: Uint8Array): Promise<boolean> {
    // Anything at the name, a link too, is something there: false, before a link is refused.
    const at = join(this.#root, ...vaultPath(path).split('/'));
    if (await lstat(at).catch(() => null)) return false;
    const file = await this.#resolve(path);
    return this.#oneAtATime(nameKey(vaultPath(path)), async () => {
      const free = async () => (await lstat(file).catch(() => null)) === null;
      if (!(await free()) || (await caseTwin(this.#look, vaultPath(path))) !== null) return false;
      await mkdir(dirname(file), { recursive: true });
      const temp = join(dirname(file), hiddenBeside(basename(file), NEW_SUFFIX));
      try {
        // Inside the try: a write cut short (the disk full) leaves no temp file behind.
        await writeFlushed(temp, bytes);
        const linked = await linkInstead(temp, file);
        if (linked === 'taken') return false;
        if (linked === 'no links') {
          if (!(await free())) return false;
          await renameWithRetry(temp, file);
        }
      } finally {
        await rm(temp, { force: true });
      }
      await syncFolder(dirname(file));
      return true;
    });
  }

  /** A write to the file being moved finishes first, so it can't land at the old name. */
  async move(from: string, to: string): Promise<MoveResult> {
    const source = await this.#resolve(from);
    const target = await this.#resolve(to);
    return this.#oneAtATime(nameKey(vaultPath(from)), async () => {
      const there = await lstat(source).catch(() => null);
      if (!there) return { ok: false, reason: 'missing' };
      if (nameKey(vaultPath(to)).startsWith(`${nameKey(vaultPath(from))}/`)) {
        return { ok: false, reason: 'into-itself' };
      }
      if ((await caseTwin(this.#look, vaultPath(to), vaultPath(from))) !== null)
        return { ok: false, reason: 'taken' };
      // Something at `to` is in the way, unless it's this very entry under another case.
      const atTarget = await realpath(target).catch(() => null);
      if (atTarget !== null && atTarget !== (await realpath(source)))
        return { ok: false, reason: 'taken' };
      await mkdir(dirname(target), { recursive: true });
      const free = async () => (await lstat(target).catch(() => null)) === null;
      if (atTarget !== null) {
        await renameWithRetry(source, target); // the same file, under another case
      } else if (there.isFile()) {
        const linked = await linkInstead(source, target);
        if (linked === 'taken') return { ok: false, reason: 'taken' }; // it appeared meanwhile: kept
        if (linked === 'no links') {
          if (!(await free())) return { ok: false, reason: 'taken' };
          await renameWithRetry(source, target);
        }
      } else {
        // A folder can't be linked: look once more, then rename.
        if (!(await free())) return { ok: false, reason: 'taken' };
        await renameWithRetry(source, target);
      }
      await syncFolder(dirname(target));
      if (dirname(source) !== dirname(target)) await syncFolder(dirname(source));
      return { ok: true };
    });
  }

  async trash(path: string): Promise<void> {
    const file = await this.#resolve(path);
    if (!(await lstat(file).catch(() => null))) throw new Error(`Nothing to trash: ${path}`);
    await this.#oneAtATime(nameKey(vaultPath(path)), () => this.#trashItem(file));
  }

  async makeFolder(path: string): Promise<void> {
    const folder = await this.#resolve(path);
    const twin = await caseTwin(this.#look, vaultPath(path));
    if (twin !== null) throw twinError(twin);
    await mkdir(folder, { recursive: true });
  }

  /** Run `task` after every earlier one for `key` has finished. */
  #oneAtATime<T>(key: string, task: () => Promise<T>): Promise<T> {
    const before = this.#writing.get(key) ?? Promise.resolve();
    const run = before.then(task, task);
    const settled = run.then(
      () => undefined,
      () => undefined,
    );
    this.#writing.set(key, settled);
    void settled.then(() => {
      if (this.#writing.get(key) === settled) this.#writing.delete(key);
    });
    return run;
  }

  /** A file's text, or null when there's no file there (or a folder, or something under a file). */
  async #readFile(file: string): Promise<FileState | null> {
    try {
      const text = await readFile(file, 'utf8');
      return { text, version: versionOf(text) };
    } catch (error) {
      if (isNoFile(error)) return null;
      throw error;
    }
  }

  watch(onChange: (paths: string[]) => void, ready?: () => void): () => void {
    return watchFolder(this.#root, onChange, ready);
  }

  /** The absolute file for a vault path, refusing anything that escapes the vault. */
  async #resolve(path: string): Promise<string> {
    const file = this.#file(vaultPath(path));
    // The nearest folder that exists, resolved through any symlinks, must be inside the vault.
    let folder = dirname(file);
    for (;;) {
      const real = await realpath(folder).catch(() => null);
      if (real !== null) {
        if (!isInside(this.#root, real)) throw new VaultPathError(path, 'outside the vault');
        break;
      }
      folder = dirname(folder);
    }
    const stats = await lstat(file).catch(() => null);
    if (stats?.isSymbolicLink()) throw new VaultPathError(path, 'a symbolic link');
    return file;
  }
}

/** A DiskStorage for the folder at `root` (resolved to its real path). */
export async function openDiskStorage(root: string, trashItem?: TrashItem): Promise<DiskStorage> {
  const real = await realpath(root);
  const stats = await lstat(real);
  if (!stats.isDirectory()) throw new Error(`Not a folder: ${root}`);
  return new DiskStorage(real, trashItem);
}

/** Content hash: equal exactly when the text is. */
const versionOf = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const isInside = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^[a-zA-Z]:/.test(rel));
};

/** No file there: nothing, a folder, or a path through a file. */
const isNoFile = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'EISDIR');
