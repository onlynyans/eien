// Writing files on the disk so a crash can't leave half of one (spec §3):
// through a hidden temp file, flushed, then renamed or linked into place,
// and the folder flushed; a rename tried again while Windows holds a file.

import { link, open, rename, rm, unlink } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { tempBeside } from '../stray';

/** How many tokens a write tries for its temp file: another one only if it was taken. */
const TEMP_TRIES = 5;

/**
 * Write through a hidden temp file of this write's own (../stray.ts): write,
 * flush to disk, rename over the file, then flush the folder. A crash leaves
 * the old file or the new one. If `stillWanted` answers false just before
 * the rename, the temp file is removed, the file is left as it is, and the
 * answer is false.
 */
export async function writeDurably(
  file: string,
  text: string,
  stillWanted: () => Promise<boolean> = async () => true,
): Promise<boolean> {
  // `file` is a system path ("\\" on Windows): its name comes from node:path, not the vault's "/" helpers.
  const temp = await writeTemp(file, text);
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

/** A new temp file beside `file` holding `text`, flushed: never one that's there already. */
async function writeTemp(file: string, text: string): Promise<string> {
  for (let tries = 1; ; tries++) {
    const temp = join(dirname(file), tempBeside(basename(file)));
    try {
      await writeFlushed(temp, text, 'wx');
      return temp;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || tries >= TEMP_TRIES) throw error;
    }
  }
}

/**
 * Write `data` to `file` (UTF-8 for text) and flush it to the disk. With the
 * flag "wx", only where there's no file: EEXIST, and nothing written, if there is.
 */
export async function writeFlushed(
  file: string,
  data: string | Uint8Array,
  flag: 'w' | 'wx' = 'w',
): Promise<void> {
  const handle = await open(file, flag);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

/**
 * On Windows a file another program has open (a sync tool, a virus scan)
 * can't be replaced for a moment: try a few times. On failure `from` is
 * left as it is — it may be the writer's note, moving.
 */
export async function renameWithRetry(from: string, to: string): Promise<void> {
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
export async function linkInstead(
  from: string,
  to: string,
): Promise<'moved' | 'taken' | 'no links'> {
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
export async function syncFolder(folder: string): Promise<void> {
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
