// A path inside the vault, as the window and the main process pass it:
// relative, with "/" between parts, never climbing out.

import { isValidName } from './names';

export class VaultPathError extends Error {
  constructor(path: string, reason: string) {
    super(`Not a path inside the vault (${reason}): ${JSON.stringify(path)}`);
    this.name = 'VaultPathError';
  }
}

/**
 * `path` checked: "/" separators, no empty parts, no "." or "..", nothing
 * absolute, every part a valid name. Throws VaultPathError. The empty
 * string is the vault itself. Names are kept exactly as written: on Linux
 * and Android "Café" composed and decomposed are two different files, so
 * a listed name must reach the disk unchanged. Compare names with nameKey.
 */
export function vaultPath(path: string): string {
  if (typeof path !== 'string') throw new VaultPathError(String(path), 'not text');
  if (path === '') return '';
  if (path.includes('\\')) throw new VaultPathError(path, 'backslash');
  if (path.startsWith('/') || /^[a-zA-Z]:/.test(path)) throw new VaultPathError(path, 'absolute');
  const parts = path.split('/');
  for (const part of parts) {
    if (part === '') throw new VaultPathError(path, 'empty part');
    if (!isValidName(part)) throw new VaultPathError(path, `invalid name "${part}"`);
  }
  return path;
}

/** The folder holding `path` ("" for the vault itself). */
export const parentOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf('/')));

/** The last part of `path`. */
export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

/** Whether `path` is `folder` or lies inside it (never "Fiction/…" for "Fic"; nothing for the vault itself, ""). */
export const isInside = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(`${folder}/`);

/** `folder` and `name` joined. */
export const joinPath = (folder: string, name: string): string =>
  folder ? `${folder}/${name}` : name;
