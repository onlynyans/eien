// After a crash on the phone (spec §3), as the desktop's recover-strays: a
// write's temp file holding words its note doesn't is kept as a
// "(recovered …)" note beside it, and then it goes; one that can't be read
// now waits for the next time. A rename the storage makes in two steps can
// be cut between them too; what's left under its step's hidden name is put
// back under its own, or, if that's taken now, beside it as "(recovered …)".
// Words never lost.

import { isHiddenName, nameKey, recoveredName } from '../../core/paths';
import type { Storage } from '../storage';
import { besideOf, steppedFrom, strayHoldsWords, TEMP_SUFFIX } from '../stray';
import { type FileEntry, type FilesPort, TakenError } from './files';

const joined = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

/** How many names are tried for a step put back while others keep arriving. */
const PUT_BACK_TRIES = 5;

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
      const back = steppedFrom(entry.name);
      const noteName = entry.type === 'file' ? besideOf(entry.name, TEMP_SUFFIX) : null;
      if (back !== null) {
        const put = await putBack(files, folder, entry, back, names, now);
        if (put !== null) recovered.push(put);
        if (put !== null && entry.type === 'directory' && !isHiddenName(back)) await walk(put);
      } else if (entry.type === 'directory') {
        if (!isHiddenName(entry.name)) await walk(path); // .eien, .git and the like
      } else if (noteName !== null) {
        const made = await keepTemp(files, storage, folder, entry, noteName, names, now);
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
  const from = joined(folder, entry.name);
  for (let tries = 0; tries < PUT_BACK_TRIES; tries++) {
    const taken = names.some((other) => other !== entry.name && nameKey(other) === nameKey(name));
    const to = taken ? recoveredName(name, now, names, entry.type === 'directory') : name;
    try {
      await files.renameNew(from, joined(folder, to)); // never over what arrived meanwhile
      names.push(to);
      return joined(folder, to);
    } catch (error) {
      if (!(error instanceof TakenError)) return null; // left as it is, for the next open
      names.push(to); // arrived since the folder was listed: the next name
    }
  }
  return null;
}

/** A temp file's words as a "(recovered …)" note when its note lacks them; then it goes. */
async function keepTemp(
  files: FilesPort,
  storage: Storage,
  folder: string,
  entry: FileEntry,
  noteName: string,
  names: string[],
  now: Date,
): Promise<string | null> {
  const temp = joined(folder, entry.name);
  const text = await files.readText(temp).catch(() => null);
  if (text === null) return null; // can't be read now: its words unread, it waits for next time
  const noteText = await files.readText(joined(folder, noteName)).catch(() => null);
  let made: string | null = null;
  if (strayHoldsWords(text, noteText)) {
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
