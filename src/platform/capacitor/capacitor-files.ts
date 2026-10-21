// The phone's file system for the vault (./files.ts), over Capacitor's
// Filesystem plugin: a folder (`root`, "Eien") in one of the system's places
// — on Android the shared Documents, which Syncthing syncs (spec §10); on
// iOS the app's own Documents, which the Files app shows. On Android the
// writes and renames are Eien's own plugin's (VaultFilesPlugin.java): the
// Filesystem plugin's write is never flushed to the disk, and its rename
// deletes the file it replaces before renaming, so a rename that fails
// loses both.

import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { type FileEntry, type FilesPort, TakenError } from './files';

/** Paths are in the shared Documents. Rejects with the code "TAKEN" for a name that's taken. */
interface VaultFilesPlugin {
  write(options: { path: string; text: string }): Promise<void>;
  rename(options: { from: string; to: string; replace: boolean }): Promise<void>;
}

const VaultFiles = registerPlugin<VaultFilesPlugin>('VaultFiles');

/** Whether the Filesystem plugin failed because nothing is there (on Android, and on the web). */
const isMissing = (error: unknown): boolean => {
  const { code, message } = (error ?? {}) as { code?: unknown; message?: unknown };
  return code === 'OS-PLUG-FILE-0008' || /does not exist/iu.test(String(message));
};

export class CapacitorFiles implements FilesPort {
  readonly #directory: Directory;
  readonly #root: string;
  /** Eien's own plugin for writes and renames: on Android, in the shared Documents. */
  readonly #native: boolean;

  constructor(directory: Directory, root: string) {
    this.#directory = directory;
    this.#root = root;
    this.#native =
      directory === Directory.Documents &&
      Capacitor.getPlatform() === 'android' &&
      Capacitor.isPluginAvailable('VaultFiles');
  }

  #path(path: string): string {
    return path === '' ? this.#root : `${this.#root}/${path}`;
  }

  #at(path: string) {
    return { path: this.#path(path), directory: this.#directory };
  }

  /** `read`, or null when there's no file there; any other failure is thrown. */
  async #orNull<T>(path: string, read: () => Promise<T>): Promise<T | null> {
    try {
      return await read();
    } catch (error) {
      if (isMissing(error)) return null;
      const entry = await this.stat(path);
      if (entry === null || entry.type === 'directory') return null;
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
    // A lone surrogate as U+FFFD, as the version's hash reads it (Java would write "?").
    const words = text.toWellFormed();
    if (this.#native) await VaultFiles.write({ path: this.#path(path), text: words });
    else await Filesystem.writeFile({ ...this.#at(path), data: words, encoding: Encoding.UTF8 });
  }

  /**
   * Through the Filesystem plugin on every system, as base64: Eien's own plugin writes text.
   * Only exports are written as bytes, and an export can be made again.
   */
  async writeBytes(path: string, bytes: Uint8Array): Promise<void> {
    let binary = '';
    for (let at = 0; at < bytes.length; at += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    }
    await Filesystem.writeFile({ ...this.#at(path), data: btoa(binary) });
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
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
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
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async rename(from: string, to: string): Promise<void> {
    if (this.#native) {
      await VaultFiles.rename({ from: this.#path(from), to: this.#path(to), replace: true });
      return;
    }
    await Filesystem.rename({
      from: this.#path(from),
      to: this.#path(to),
      directory: this.#directory,
      toDirectory: this.#directory,
    });
  }

  async renameNew(from: string, to: string): Promise<void> {
    if (this.#native) {
      await VaultFiles.rename({ from: this.#path(from), to: this.#path(to), replace: false }).catch(
        (error: unknown) => {
          throw (error as { code?: unknown }).code === 'TAKEN' ? new TakenError(to) : error;
        },
      );
      return;
    }
    if (await this.stat(to)) throw new TakenError(to);
    await this.rename(from, to);
  }

  async makeFolder(path: string): Promise<void> {
    if ((await this.stat(path))?.type === 'directory') return;
    try {
      await Filesystem.mkdir({ ...this.#at(path), recursive: true });
    } catch (error) {
      // Made at the same moment by another save into the same new folder: that's fine.
      if ((await this.stat(path))?.type !== 'directory') throw error;
    }
  }

  async remove(path: string): Promise<void> {
    await Filesystem.deleteFile(this.#at(path));
  }
}
