// After a crash on the phone (spec §3), as the desktop's recover-temps: a
// write's temp file holding words its note doesn't is kept as a
// "(recovered …)" note beside it, and every temp file goes. A rename the
// storage makes in two steps can be cut between them too; what's left under
// its step's hidden name is put back under its own, or, if that's taken
// now, beside it as "(recovered …)". Words never lost.

import { isHiddenName, nameKey, recoveredName } from '../../core/paths';
import type { Storage } from '../storage';
import { isTempName, noteOfTemp, strayHoldsWords } from '../stray';
import { STEP_SUFFIXES } from './capacitor-storage';
import type { FileEntry, FilesPort } from './files';

const joined = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

/** The name a step's hidden name stands for, or null when `name` isn't one. */
function stepped(name: string): string | null {
  const suffix = STEP_SUFFIXES.find((end) => name.endsWith(end));
  if (!suffix || !name.startsWith('.') || name.length <= suffix.length + 1) return null;
  return name.slice(1, -suffix.length);
}

/** The vault paths recovered: notes made from temp files, and names put back. */
export async function recoverStrays(
  files: FilesPort,
  storage: Storage,
  now = new Date(),
): Promise<string[]> {
  const recovered: string[] = [];
  const walk = async (folder: string): Promise<void> => {
    const entries = (await files.list(folder)) ?? [];
    const names = entries.map((entry) => entry.name);
    for (const entry of entries) {
      const path = joined(folder, entry.name);
      const back = stepped(entry.name);
      if (back !== null) {
        const put = await putBack(files, folder, entry, back, names, now);
        if (put !== null) recovered.push(put);
        if (put !== null && entry.type === 'directory' && !isHiddenName(back)) await walk(put);
      } else if (entry.type === 'directory') {
        if (!isHiddenName(entry.name)) await walk(path); // .eien, .git and the like
      } else if (isTempName(entry.name)) {
        const made = await keepTemp(files, storage, folder, entry, names, now);
        if (made !== null) recovered.push(made);
      }
    }
  };
  await walk('');
  return recovered;
}

/** Back under `name`, or beside what's there now; null if it can't be moved. */
async function putBack(
  files: FilesPort,
  folder: string,
  entry: FileEntry,
  name: string,
  names: string[],
  now: Date,
): Promise<string | null> {
  const taken = names.some((other) => other !== entry.name && nameKey(other) === nameKey(name));
  const to = taken ? recoveredName(name, now, names, entry.type === 'directory') : name;
  try {
    await files.rename(joined(folder, entry.name), joined(folder, to));
  } catch {
    return null; // left as it is, for the next time the vault opens
  }
  names.push(to);
  return joined(folder, to);
}

/** A temp file's words as a "(recovered …)" note when its note lacks them; then it goes. */
async function keepTemp(
  files: FilesPort,
  storage: Storage,
  folder: string,
  entry: FileEntry,
  names: string[],
  now: Date,
): Promise<string | null> {
  const temp = joined(folder, entry.name);
  const noteName = noteOfTemp(entry.name);
  const text = (await files.readText(temp).catch(() => null)) ?? '';
  const noteEntry = await files.stat(joined(folder, noteName));
  const noteText =
    noteEntry?.type === 'file'
      ? await files.readText(joined(folder, noteName)).catch(() => null)
      : null;
  const note = noteEntry && noteText !== null ? { text: noteText, mtime: noteEntry.mtime } : null;
  let made: string | null = null;
  if (strayHoldsWords({ text, mtime: entry.mtime }, note)) {
    const name = recoveredName(noteName, now, names);
    const target = joined(folder, name);
    const result = await storage.write(target, text, null).catch(() => null);
    if (!result?.ok) return null; // the temp stays for next time: its words aren't kept yet
    names.push(name);
    made = target;
  }
  await files.remove(temp).catch(() => undefined);
  return made;
}
