// The phone's trash (spec §10): a phone has none for files, so trashed
// notes go to .eien/trash in the vault (decided 2026-10-20), a folder for
// each moment, where any device can take them back as a system's trash
// keeps them. Never over what arrived meanwhile (renameNew).

import { TRASH_STEP } from '../stray';
import { besidePath, type FilesPort, folderOf, nameOf, TakenError } from './files';

/** Where trashed files go: in the vault, hidden, a folder for each moment something was trashed. */
export const TRASH_FOLDER = '.eien/trash';

/** A trash folder's name for the moment `ms`: "2026-10-20T22-40-00-123Z". */
const stampOf = (ms: number) => new Date(ms).toISOString().replace(/[:.]/gu, '-');

/** The file or folder at `at` into a folder of its own in the trash, named for `now`. */
export async function trashInto(files: FilesPort, at: string, now: number): Promise<void> {
  // What holds the trash (.eien, a file of that name, the trash itself) steps aside first.
  const holds = `${TRASH_FOLDER}/`.startsWith(`${at}/`);
  const from = holds ? besidePath(at, TRASH_STEP) : at;
  if (holds) await files.renameNew(at, from);
  try {
    const stamp = stampOf(now);
    for (let n = 1; ; n++) {
      // The same name trashed in the same moment takes the next folder.
      const into = `${TRASH_FOLDER}/${n === 1 ? stamp : `${stamp}-${n}`}/${nameOf(at)}`;
      if (await files.stat(into)) continue;
      await files.makeFolder(folderOf(into));
      try {
        await files.renameNew(from, into);
        return;
      } catch (error) {
        if (!(error instanceof TakenError)) throw error;
      }
    }
  } catch (error) {
    if (holds) await files.renameNew(from, at).catch(() => undefined); // back where it was
    throw error;
  }
}
