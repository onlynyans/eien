// The phone's file system for the vault (./files.ts), over Capacitor's
// Filesystem plugin: a folder (`root`, "Eien") in one of the system's places
// — on Android the shared Documents, which Syncthing syncs (spec §10); on
// iOS the app's own Documents, which the Files app shows.

import { type Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { FileEntry, FilesPort } from './files';

export class CapacitorFiles implements FilesPort {
  readonly #directory: Directory;
  readonly #root: string;

  constructor(directory: Directory, root: string) {
    this.#directory = directory;
    this.#root = root;
  }

  #at(path: string) {
    return { path: path === '' ? this.#root : `${this.#root}/${path}`, directory: this.#directory };
  }

  /** `read`, or null when there's nothing there (the plugin throws for that as for any failure). */
  async #orNull<T>(path: string, read: () => Promise<T>): Promise<T | null> {
    try {
      return await read();
    } catch (error) {
      if ((await this.stat(path)) === null) return null;
      throw error;
    }
  }

  readText(path: string): Promise<string | null> {
    return this.#orNull(path, async () => {
      const { data } = await Filesystem.readFile({ ...this.#at(path), encoding: Encoding.UTF8 });
      return typeof data === 'string' ? data : await data.text();
    });
  }

  readBytes(path: string): Promise<Uint8Array | null> {
    return this.#orNull(path, async () => {
      const { data } = await Filesystem.readFile(this.#at(path)); // base64, without an encoding
      if (typeof data !== 'string') return new Uint8Array(await data.arrayBuffer());
      return Uint8Array.from(atob(data), (char) => char.charCodeAt(0));
    });
  }

  async writeText(path: string, text: string): Promise<void> {
    await Filesystem.writeFile({ ...this.#at(path), data: text, encoding: Encoding.UTF8 });
  }

  async stat(path: string): Promise<FileEntry | null> {
    try {
      const info = await Filesystem.stat(this.#at(path));
      return {
        name: path.slice(path.lastIndexOf('/') + 1),
        type: info.type,
        size: info.type === 'directory' ? 0 : info.size,
        mtime: info.mtime,
      };
    } catch {
      return null;
    }
  }

  async list(folder: string): Promise<FileEntry[] | null> {
    try {
      const { files } = await Filesystem.readdir(this.#at(folder));
      return files.map((file) => ({
        name: file.name,
        type: file.type,
        size: file.type === 'directory' ? 0 : file.size,
        mtime: file.mtime,
      }));
    } catch {
      return null;
    }
  }

  async rename(from: string, to: string): Promise<void> {
    await Filesystem.rename({
      from: this.#at(from).path,
      to: this.#at(to).path,
      directory: this.#directory,
      toDirectory: this.#directory,
    });
  }

  async makeFolder(path: string): Promise<void> {
    if ((await this.stat(path))?.type === 'directory') return;
    await Filesystem.mkdir({ ...this.#at(path), recursive: true });
  }

  async remove(path: string): Promise<void> {
    await Filesystem.deleteFile(this.#at(path));
  }
}
