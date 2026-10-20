// A vault on disk, for the Electron main process (spec §3: durable writes,
// paths kept inside the vault, a watcher).

import { createHash } from 'node:crypto';
import { type Dirent, type FSWatcher, watch } from 'node:fs';
import {
  link,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { isHiddenName, isWatchedPath, nameKey, VaultPathError, vaultPath } from '../../core/paths';
import { kindOf, type VaultEntry } from '../../core/vault';
import {
  type FileState,
  MAX_BYTES_READ,
  type MoveResult,
  type Storage,
  type WriteResult,
} from '../storage';
import { hiddenBeside, TEMP_SUFFIX } from '../stray';

/** The hidden file a write goes through: ".<name>.eien.tmp" beside it (../stray.ts). */
export const tempNameOf = (name: string): string => hiddenBeside(name, TEMP_SUFFIX);

/** Sends a file or folder (an absolute path) to the system's trash; throws when it can't. */
export type TrashItem = (path: string) => Promise<void>;

const noTrash: TrashItem = async () => {
  throw new Error('There is no trash to send it to on this system.');
};

/** Bursts of changes are reported together, this long after the last. */
const WATCH_SETTLE_MS = 120;

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
    await mkdir(await this.#resolve(path), { recursive: true });
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

  watch(onChange: (paths: string[]) => void): () => void {
    let pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watcher: FSWatcher | undefined;
    try {
      watcher = watch(this.#root, { recursive: true }, (_event, name) => {
        if (!name) return;
        const path = name.split(sep).join('/');
        if (!isWatchedPath(path)) return; // our temp files, dot-files, .eien but its settings
        pending.add(path);
        // A burst is told WATCH_SETTLE_MS after its first change, with all that changed
        // meanwhile. Waiting for quiet instead would let one file written without pause
        // (a sync tool's download, another app's autosave) hold every report back.
        if (timer !== undefined) return;
        timer = setTimeout(() => {
          timer = undefined;
          const paths = [...pending];
          pending = new Set();
          onChange(paths);
        }, WATCH_SETTLE_MS);
      });
      watcher.on('error', () => watcher?.close());
    } catch {
      // No watching on this system: changes are seen on the next read.
    }
    return () => {
      clearTimeout(timer);
      watcher?.close();
    };
  }

  /** The absolute file for a vault path, refusing anything that escapes the vault. */
  async #resolve(path: string): Promise<string> {
    const relativePath = vaultPath(path);
    const file = join(this.#root, ...relativePath.split('/'));
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

/**
 * Write through a hidden temp file: write, flush to disk, rename over the
 * file, then flush the folder. A crash leaves the old file or the new one.
 * If `stillWanted` answers false just before the rename, the temp file is
 * removed, the file is left as it is, and the answer is false.
 */
export async function writeDurably(
  file: string,
  text: string,
  stillWanted: () => Promise<boolean> = async () => true,
): Promise<boolean> {
  // `file` is a system path ("\\" on Windows): its name comes from node:path, not the vault's "/" helpers.
  const temp = join(dirname(file), tempNameOf(basename(file)));
  const handle = await open(temp, 'w');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  if (!(await stillWanted())) {
    await rm(temp, { force: true });
    return false;
  }
  try {
    await renameWithRetry(temp, file);
  } catch (error) {
    await rm(temp, { force: true }); // the temp file, never the note
    throw error;
  }
  await syncFolder(dirname(file));
  return true;
}

/**
 * On Windows a file another program has open (a sync tool, a virus scan)
 * can't be replaced for a moment: try a few times. On failure `from` is
 * left as it is — it may be the writer's note, moving.
 */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) throw error;
      await new Promise((done) => setTimeout(done, 50 * attempt));
    }
  }
}

/**
 * Move a file by giving it its new name and then dropping the old: `link`
 * never replaces anything, so a file that appeared at `to` meanwhile (a sync
 * tool's) is safe. On a disk without links (FAT, exFAT, some network drives)
 * nothing is done, for the caller to rename.
 */
async function linkInstead(from: string, to: string): Promise<'moved' | 'taken' | 'no links'> {
  try {
    await link(from, to);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'EEXIST') return 'taken';
    if (['EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS', 'EXDEV'].includes(code ?? ''))
      return 'no links';
    throw error;
  }
  try {
    await unlink(from);
  } catch (error) {
    await unlink(to).catch(() => undefined); // back as it was: one name
    throw error;
  }
  return 'moved';
}

/** So the rename itself survives a power cut. Windows can't open a folder for this; it isn't needed there. */
async function syncFolder(folder: string): Promise<void> {
  if (process.platform === 'win32') return;
  const handle = await open(folder, 'r').catch(() => null);
  if (!handle) return;
  try {
    await handle.sync();
  } catch {
    // Some file systems don't support it; the rename has still happened.
  } finally {
    await handle.close();
  }
}
