// After a crash: a write's hidden temp file may be left beside its note
// (spec §3). One newer than the note, holding different words, is kept as
// a "(recovered …)" sibling; then every temp file goes. Words never lost.

import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { isHiddenName, recoveredName } from '../../core/paths';
import { isTempName, noteOfTemp, strayHoldsWords } from '../stray';
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
      if (!dirent.isFile() || !isTempName(dirent.name)) continue;
      const temp = join(storage.root, path);
      const noteName = noteOfTemp(dirent.name);
      const note = join(storage.root, folder, noteName);
      const [tempStats, noteStats] = await Promise.all([stat(temp), stat(note).catch(() => null)]);
      const text = await readFile(temp, 'utf8').catch(() => '');
      const noteText = noteStats ? await readFile(note, 'utf8').catch(() => null) : null;
      const written =
        noteStats && noteText !== null ? { text: noteText, mtime: noteStats.mtimeMs } : null;
      if (strayHoldsWords({ text, mtime: tempStats.mtimeMs }, written)) {
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
