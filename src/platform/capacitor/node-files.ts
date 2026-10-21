// The phone storage's file system played by Node's fs on a folder, for the
// storage contract tests (../storage.test.ts): the same calls the phone
// makes, with the same answers.

import { link, mkdir, open, readdir, readFile, rename, rm, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { type FileEntry, type FilesPort, TakenError } from './files';

const codeOf = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

/** Null for "nothing there"; any other failure is thrown. */
const orMissing =
  <T>(...codes: string[]) =>
  (error: unknown): T | null => {
    if (['ENOENT', 'ENOTDIR', ...codes].includes(codeOf(error))) return null;
    throw error;
  };

export class NodeFiles implements FilesPort {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  #at(path: string): string {
    return path === '' ? this.#root : join(this.#root, ...path.split('/'));
  }

  readText(path: string): Promise<string | null> {
    return readFile(this.#at(path), 'utf8').catch(orMissing<string>('EISDIR'));
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const bytes = await readFile(this.#at(path)).catch(orMissing<Buffer>('EISDIR'));
    return bytes ? new Uint8Array(bytes) : null;
  }

  async writeText(path: string, text: string): Promise<void> {
    const file = await open(this.#at(path), 'w');
    try {
      await file.writeFile(text, 'utf8');
      await file.sync();
    } finally {
      await file.close();
    }
  }

  async stat(path: string): Promise<FileEntry | null> {
    const stats = await stat(this.#at(path)).catch(orMissing<null>());
    if (!stats) return null;
    return {
      name: path.slice(path.lastIndexOf('/') + 1),
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.isDirectory() ? 0 : stats.size,
      mtime: stats.mtimeMs,
    };
  }

  async list(folder: string): Promise<FileEntry[] | null> {
    const names = await readdir(this.#at(folder), { withFileTypes: true }).catch(orMissing<null>());
    if (!names) return null;
    const entries: FileEntry[] = [];
    for (const dirent of names) {
      if (!dirent.isFile() && !dirent.isDirectory()) continue; // links and the like: not the phone's
      const entry = await this.stat(folder ? `${folder}/${dirent.name}` : dirent.name);
      if (entry) entries.push(entry);
    }
    return entries;
  }

  async rename(from: string, to: string): Promise<void> {
    await rename(this.#at(from), this.#at(to));
  }

  /** A file by a hard link, which refuses a name that's taken, by any case the system ignores. */
  async renameNew(from: string, to: string): Promise<void> {
    const source = this.#at(from);
    const target = this.#at(to);
    if ((await stat(source)).isDirectory()) {
      if (await this.stat(to)) throw new TakenError(to);
      await rename(source, target);
      return;
    }
    await link(source, target).catch((error) => {
      throw codeOf(error) === 'EEXIST' ? new TakenError(to) : error;
    });
    await unlink(source);
  }

  async makeFolder(path: string): Promise<void> {
    await mkdir(this.#at(path), { recursive: true });
  }

  async remove(path: string): Promise<void> {
    await rm(this.#at(path));
  }
}
