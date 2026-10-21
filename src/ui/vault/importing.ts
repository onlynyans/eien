// File → Import Markdown Folder… (spec §8), for the window: the main
// process asks for the folder and copies its notes; the window reads the
// vault again, shows the new folder, and says how many came in.

import type { ImportReport } from '../../core/import';
import type { VaultBridge } from '../../platform/bridge';
import { reasonOf } from '../reason';

export interface ImportParts {
  readonly vault: VaultBridge;
  /** Run a file operation, then read the vault again (one at a time). */
  act(operation: () => Promise<unknown>): Promise<void>;
  /** Show a folder in the sidebar and the list. */
  showFolder(path: string): void;
  tell(message: string): void;
}

const count = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** The news an import ends with. */
export function importNews(report: ImportReport): string {
  const left = report.left.length ? ` ${count(report.left.length, 'file')} didn’t come in.` : '';
  if (report.folder)
    return `Imported ${count(report.copied, 'note')} into “${report.folder}”.${left}`;
  // "No notes there" only when that's so: notes that couldn't come in are notes.
  const notes = report.left.some((each) => each.reason !== 'not-a-note');
  return notes ? `Nothing imported.${left}` : `Nothing imported: no notes there.${left}`;
}

export async function importFolder(parts: ImportParts): Promise<void> {
  let report: ImportReport | null = null;
  try {
    await parts.act(async () => {
      report = await parts.vault.importFolder();
    });
  } catch (error) {
    parts.tell(`It couldn’t be imported: ${reasonOf(error)}`);
    return;
  }
  const done = report as ImportReport | null;
  if (!done) return; // cancelled
  if (done.folder) parts.showFolder(done.folder);
  parts.tell(importNews(done));
}
