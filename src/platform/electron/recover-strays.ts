// After a crash (spec §3), what's left in the vault is put back when it
// opens. A write's hidden temp file holding words its note doesn't is kept
// as a "(recovered …)" sibling, then removed; one that can't be read now is
// left for the next time. A phone's rename cut between its two steps, brought
// here by Syncthing, is put back under its own name, or beside what's there
// now, never over it (Storage.move). A new file's temp (an import's image) is
// removed: what it held is still where it was copied from. Words never lost.

import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { isHiddenName, nameKey, recoveredName } from '../../core/paths';
import { besideOf, NEW_SUFFIX, steppedFrom, strayHoldsWords, tempFor } from '../stray';
import type { DiskStorage } from './disk-storage';

/** How many names are tried for a step put back while others keep arriving. */
const PUT_BACK_TRIES = 5;

const joined = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

/** The vault paths recovered: notes made from temp files, and names put back. */
export async function recoverStrays(storage: DiskStorage, now = new Date()): Promise<string[]> {
  const recovered: string[] = [];
  const walk = async (folder: string): Promise<void> => {
    const dirents = await readdir(join(storage.root, folder), { withFileTypes: true }).catch(
      () => [],
    );
    const names = dirents.map((dirent) => dirent.name);
    for (const dirent of dirents) {
      const path = joined(folder, dirent.name);
      const real = dirent.isFile() || dirent.isDirectory(); // not a link, nor anything stranger
      const back = real ? steppedFrom(dirent.name) : null;
      if (back !== null) {
        const put = await putBack(
          storage,
          folder,
          dirent.name,
          back,
          names,
          now,
          dirent.isDirectory(),
        );
        if (put !== null) recovered.push(put);
        if (put !== null && dirent.isDirectory() && !isHiddenName(back)) await walk(put);
      } else if (dirent.isDirectory()) {
        if (!isHiddenName(dirent.name)) await walk(path); // .eien, .git and the like
      } else if (dirent.isFile() && besideOf(dirent.name, NEW_SUFFIX) !== null) {
        // A new file's bytes cut short (an import's image): still where they were copied from.
        await rm(join(storage.root, folder, dirent.name), { force: true });
      } else if (dirent.isFile()) {
        const made = await keepTemp(storage, folder, dirent.name, names, now);
        if (made !== null) recovered.push(made);
      }
    }
  };
  await walk('');
  return recovered;
}

/** Back under `name`, or beside what's there now; null if it can't be moved now. */
async function putBack(
  storage: DiskStorage,
  folder: string,
  step: string,
  name: string,
  names: string[],
  now: Date,
  isFolder: boolean,
): Promise<string | null> {
  for (let tries = 0; tries < PUT_BACK_TRIES; tries++) {
    const taken = names.some((other) => other !== step && nameKey(other) === nameKey(name));
    const to = taken ? recoveredName(name, now, names, isFolder) : name;
    const result = await storage.move(joined(folder, step), joined(folder, to)).catch(() => null);
    if (result?.ok) {
      names.push(to);
      return joined(folder, to);
    }
    if (result?.reason !== 'taken') return null; // left as it is, for the next open
    names.push(to); // arrived since the folder was read: the next name
  }
  return null;
}

/** A temp file's words as a "(recovered …)" note when its note lacks them; then it goes. */
async function keepTemp(
  storage: DiskStorage,
  folder: string,
  temp: string,
  names: string[],
  now: Date,
): Promise<string | null> {
  const noteName = tempFor(temp);
  if (noteName === null) return null;
  const file = join(storage.root, folder, temp);
  const text = await readFile(file, 'utf8').catch(() => null);
  if (text === null) return null; // can't be read now: its words unread, it waits for next time
  const noteText = await readFile(join(storage.root, folder, noteName), 'utf8').catch(() => null);
  let made: string | null = null;
  if (strayHoldsWords(text, noteText)) {
    const name = recoveredName(noteName, now, names);
    const target = joined(folder, name);
    const result = await storage.write(target, text, null);
    if (!result.ok) return null; // something's there after all: leave the temp for next time
    names.push(name);
    made = target;
  }
  await rm(file, { force: true });
  return made;
}
