// A folder outside the vault, read for an import (spec §8): listed and read
// without ever following a link, even one put in a file's or a folder's
// place after the listing; and told apart from the vault by what each is on
// the disk, not by how its path is spelled (macOS's /System/Volumes/Data,
// a bind mount, another case).

import { constants, type Dirent } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { type LeftOut, MAX_IMPORT_NOTES, type SourceFile } from '../../core/import';
import { isHiddenName } from '../../core/paths';

/** Files listed past this stop the listing: a home folder isn't a folder of notes. */
export const MAX_LISTED = 10 * MAX_IMPORT_NOTES;
/** Folders deeper than this aren't looked into. */
const MAX_DEPTH = 64;

const byName = (a: Dirent, b: Dirent) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

/**
 * The files in `root`, at any depth: hidden ones left out, links named and
 * not followed. Past `most` files it stops, and says where.
 */
export async function listFolder(
  root: string,
  most = MAX_LISTED,
): Promise<{ files: SourceFile[]; left: LeftOut[] }> {
  const files: SourceFile[] = [];
  const left: LeftOut[] = [];
  let full = false;
  const walk = async (folder: string, depth: number): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(join(root, ...folder.split('/').filter(Boolean)), {
        withFileTypes: true,
      });
    } catch {
      left.push({ path: folder || '.', reason: 'unreadable' });
      return;
    }
    for (const entry of entries.sort(byName)) {
      if (full) return;
      if (isHiddenName(entry.name)) continue;
      const path = folder ? `${folder}/${entry.name}` : entry.name;
      if (files.length + left.length >= most) {
        left.push({ path, reason: 'not-looked-at' }); // it, and everything after it
        full = true;
        return;
      }
      if (entry.isSymbolicLink()) left.push({ path, reason: 'link' });
      else if (entry.isDirectory()) {
        if (depth >= MAX_DEPTH) left.push({ path, reason: 'too-deep' });
        else await walk(path, depth + 1);
      } else if (entry.isFile()) {
        const stats = await lstat(join(root, ...path.split('/'))).catch(() => null);
        if (stats) files.push({ path, size: stats.size });
        else left.push({ path, reason: 'unreadable' });
      } else left.push({ path, reason: 'not-a-note' }); // a socket, a device: nothing to read
    }
  };
  await walk('', 0);
  return { files, left };
}

/** Two spellings of one folder, as the system compares them. */
const samePath = (a: string, b: string) =>
  process.platform === 'linux' ? a === b : a.toLowerCase() === b.toLowerCase();

/**
 * The bytes of the file at `path` in `root` (a real, absolute folder), or
 * 'link' when it or a folder on the way is one, or null when it can't be read.
 */
export async function readNoLinks(root: string, path: string): Promise<Uint8Array | 'link' | null> {
  let at = root;
  for (const part of path.split('/')) {
    at = join(at, part);
    const there = await lstat(at).catch(() => null);
    if (!there) return null;
    if (there.isSymbolicLink()) return 'link';
  }
  // O_NOFOLLOW where the system has it: a link put there now isn't opened.
  const handle = await open(at, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)).catch(
    (error: { code?: string }) => (error.code === 'ELOOP' ? 'link' : null),
  );
  if (handle === null || handle === 'link') return handle;
  try {
    // What was opened is what was looked at, in the folder's own folder (not a link's target).
    const [opened, looked, folder] = await Promise.all([
      handle.stat({ bigint: true }),
      lstat(at, { bigint: true }),
      realpath(dirname(at)),
    ]);
    const same = opened.ino === looked.ino && opened.dev === looked.dev;
    if (!same || !samePath(folder, dirname(at))) return 'link';
    return new Uint8Array(await handle.readFile());
  } catch {
    return null;
  } finally {
    await handle.close();
  }
}

/** Whether the folder `inner` is `outer`, or inside it, as the disk has them. */
export async function within(inner: string, outer: string): Promise<boolean> {
  const target = await stat(outer, { bigint: true });
  for (let at = await realpath(inner); ; at = dirname(at)) {
    const here = await stat(at, { bigint: true }).catch(() => null);
    if (here && here.dev === target.dev && here.ino === target.ino) return true;
    if (dirname(at) === at) return false;
  }
}
