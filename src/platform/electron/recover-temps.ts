// After a crash: a write's hidden temp file may be left beside its note
// (spec §3). One holding words the note doesn't is kept as a "(recovered …)"
// sibling; then the temp file goes. One that can't be read now is left for
// the next time. Words never lost.

import { readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { isHiddenName, recoveredName } from '../../core/paths';
import { besideOf, strayHoldsWords, TEMP_SUFFIX } from '../stray';
import type { DiskStorage } from './disk-storage';

/** Names of the notes recovered, vault-relative. */
export async function recoverStrayTemps(storage: DiskStorage, now = new Date()): Promise<string[]> {
  const recovered: string[] = [];
  const walk = async (folder: string): Promise<void> => {
    const dirents = await readdir(join(storage.root, folder), { withFileTypes: true }).catch(
      () => [],
    );
    const names = dirents.map((dirent) => dirent.name);
    for (const dirent of dirents) {
      const path = folder ? `${folder}/${dirent.name}` : dirent.name;
      if (dirent.isDirectory()) {
        if (dirent.isSymbolicLink() || isHiddenName(dirent.name)) continue; // .eien, .git and the like
        await walk(path);
        continue;
      }
      const noteName = dirent.isFile() ? besideOf(dirent.name, TEMP_SUFFIX) : null;
      if (noteName === null) continue;
      const temp = join(storage.root, path);
      const text = await readFile(temp, 'utf8').catch(() => null);
      if (text === null) continue; // can't be read now: its words unread, it waits for next time
      const noteText = await readFile(join(storage.root, folder, noteName), 'utf8').catch(
        () => null,
      );
      if (strayHoldsWords(text, noteText)) {
        const name = recoveredName(noteName, now, names);
        const target = folder ? `${folder}/${name}` : name;
        const result = await storage.write(target, text, null);
        if (!result.ok) continue; // something's there after all: leave the temp for next time
        names.push(name);
        recovered.push(target);
      }
      await rm(temp, { force: true });
    }
  };
  await walk('');
  return recovered;
}
