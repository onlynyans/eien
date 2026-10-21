// Case twins (spec §3): "Chapter.md" and "chapter.md" in one folder. A
// system that tells case apart (Linux, iOS) holds both; one that ignores
// case (macOS, Windows, Android's shared storage) can't, so Syncthing
// couldn't bring both there. No storage makes one: a name is taken when an
// entry in its folder has it by nameKey, case and composition aside.

import { nameKey } from '../core/paths';

/** How a storage looks at its folders, by the system's own rule for case. */
export interface CaseLook {
  /** Whether anything is at the vault path. */
  exists(path: string): Promise<boolean>;
  /** The names directly in the folder ("" the vault), hidden ones too; none when it isn't there. */
  names(folder: string): Promise<string[]>;
}

const joined = (folder: string, name: string) => (folder ? `${folder}/${name}` : name);

/**
 * The entry that `path`, or a folder above it, would be a case twin of: the
 * first of them that isn't there, looked for in its folder under another
 * case. Null when there's none. `self` is an entry being renamed, which is
 * never its own twin. On a system that ignores case, the twin is found as
 * the path itself, so there's never one.
 */
export async function caseTwin(
  look: CaseLook,
  path: string,
  self?: string,
): Promise<string | null> {
  const parts = path.split('/');
  for (let at = 1; at <= parts.length; at++) {
    if (await look.exists(parts.slice(0, at).join('/'))) continue;
    const folder = parts.slice(0, at - 1).join('/');
    const name = parts[at - 1] as string;
    const twin = (await look.names(folder)).find(
      (other) =>
        other !== name && nameKey(other) === nameKey(name) && joined(folder, other) !== self,
    );
    return twin === undefined ? null : joined(folder, twin);
  }
  return null;
}

/** Why a folder can't be made: its name, in another case, is there already. */
export const twinError = (twin: string): Error =>
  new Error(`“${twin}” is there already: the same name in another case.`);
