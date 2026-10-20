// A vault on disk, for the Electron main process (spec §3: durable writes,
// paths kept inside the vault, a watcher).

import { createHash } from 'node:crypto';
import { type Dirent, type FSWatcher, watch } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';
import { isHiddenName, isWatchedPath, VaultPathError, vaultPath } from '../../core/paths';
import { kindOf, type VaultEntry } from '../../core/vault';
import { type FileState, MAX_BYTES_READ, type Storage, type WriteResult } from '../storage';

/** The hidden file a write goes through: ".<name>.eien.tmp" beside it. */
export const tempNameOf = (name: string): string => `.${name}.eien.tmp`;
export const TEMP_SUFFIX = '.eien.tmp';

/** Bursts of changes are reported together, this long after the last. */
const WATCH_SETTLE_MS = 120;

export class DiskStorage implements Storage {
  readonly #root: string;

  /** `root` must be a real, absolute folder path (see `openDiskStorage`). */
  constructor(root: string) {
    this.#root = root;
  }

  get root(): string {
    return this.#root;
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
    const file = await this.#resolve(path);
    try {
      const text = await readFile(file, 'utf8');
      return { text, version: versionOf(text) };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const file = await this.#resolve(path);
    const stats = await stat(file).catch(() => null);
    if (!stats?.isFile() || stats.size > MAX_BYTES_READ) return null;
    return new Uint8Array(await readFile(file));
  }

  async write(path: string, text: string, expected: string | null): Promise<WriteResult> {
    const file = await this.#resolve(path);
    const current = await this.read(path);
    if ((current?.version ?? null) !== expected) return { ok: false, current };
    await mkdir(dirname(file), { recursive: true });
    await writeDurably(file, text);
    return { ok: true, version: versionOf(text) };
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
        clearTimeout(timer);
        timer = setTimeout(() => {
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
export async function openDiskStorage(root: string): Promise<DiskStorage> {
  const real = await realpath(root);
  const stats = await lstat(real);
  if (!stats.isDirectory()) throw new Error(`Not a folder: ${root}`);
  return new DiskStorage(real);
}

/** Content hash: equal exactly when the text is. */
const versionOf = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const isInside = (root: string, path: string): boolean => {
  const rel = relative(root, path);
  return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep) && !/^[a-zA-Z]:/.test(rel));
};

const isNotFound = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';

/**
 * Write through a hidden temp file: write, flush to disk, rename over the
 * file, then flush the folder. A crash leaves the old file or the new one.
 */
export async function writeDurably(file: string, text: string): Promise<void> {
  // `file` is a system path ("\\" on Windows): its name comes from node:path, not the vault's "/" helpers.
  const temp = join(dirname(file), tempNameOf(basename(file)));
  const handle = await open(temp, 'w');
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await renameWithRetry(temp, file);
  await syncFolder(dirname(file));
}

/** On Windows a file another program has open (a sync tool, a virus scan) can't be replaced for a moment. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 5 || (code !== 'EPERM' && code !== 'EBUSY' && code !== 'EACCES')) {
        await rm(from, { force: true });
        throw error;
      }
      await new Promise((done) => setTimeout(done, 50 * attempt));
    }
  }
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
