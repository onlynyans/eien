// The phone storage's file system played by Node's fs on a folder, for the
// storage contract tests (../storage.test.ts): the same calls Capacitor's
// plugin makes on the phone, with the same answers.

import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { FileEntry, FilesPort } from './files';

const missing = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  ['ENOENT', 'ENOTDIR', 'EISDIR'].includes(String(error.code));

export class NodeFiles implements FilesPort {
  readonly #root: string;

  constructor(root: string) {
    this.#root = root;
  }

  #at(path: string): string {
    return path === '' ? this.#root : join(this.#root, ...path.split('/'));
  }

  async readText(path: string): Promise<string | null> {
    return readFile(this.#at(path), 'utf8').catch((error) => {
      if (missing(error)) return null;
      throw error;
    });
  }

  async readBytes(path: string): Promise<Uint8Array | null> {
    const bytes = await readFile(this.#at(path)).catch((error) => {
      if (missing(error)) return null;
      throw error;
    });
    return bytes ? new Uint8Array(bytes) : null;
  }

  async writeText(path: string, text: string): Promise<void> {
    await writeFile(this.#at(path), text, 'utf8');
  }

  async stat(path: string): Promise<FileEntry | null> {
    const stats = await stat(this.#at(path)).catch(() => null);
    if (!stats) return null;
    return {
      name: path.slice(path.lastIndexOf('/') + 1),
      type: stats.isDirectory() ? 'directory' : 'file',
      size: stats.isDirectory() ? 0 : stats.size,
      mtime: stats.mtimeMs,
    };
  }

  async list(folder: string): Promise<FileEntry[] | null> {
    const names = await readdir(this.#at(folder), { withFileTypes: true }).catch(() => null);
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

  async makeFolder(path: string): Promise<void> {
    await mkdir(this.#at(path), { recursive: true });
  }

  async remove(path: string): Promise<void> {
    await rm(this.#at(path));
  }
}
