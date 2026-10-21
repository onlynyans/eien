// A volume that tells case apart ("Chapter.md" and "chapter.md" are two
// files), for tests of what a case-sensitive system does (Linux, iOS): the
// temp folder where it tells case apart already; on a Mac, a case-sensitive
// APFS disk image, made and attached for the test (no admin rights needed).
// None on Windows, whose disks ignore case.

import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface CaseVolume {
  /** A new empty folder on the volume, for one test. */
  folder(): Promise<string>;
  close(): Promise<void>;
}

/** Whether `folder` keeps "a" and "A" apart. */
async function tellsCase(folder: string): Promise<boolean> {
  const probe = join(folder, 'case-probe');
  await writeFile(probe, '');
  try {
    return (await stat(join(folder, 'CASE-PROBE')).catch(() => null)) === null;
  } finally {
    await rm(probe, { force: true });
  }
}

/** A case-sensitive volume, or null where none can be had. */
export async function caseVolume(): Promise<CaseVolume | null> {
  const base = await mkdtemp(join(tmpdir(), 'eien-case-'));
  const removeBase = () => rm(base, { recursive: true, force: true });
  let root = base;
  let close = removeBase;
  if (!(await tellsCase(base))) {
    if (process.platform !== 'darwin') {
      await removeBase();
      return null;
    }
    root = join(base, 'volume');
    const image = join(base, 'case');
    await run('hdiutil', [
      ...['create', '-quiet', '-size', '64m', '-type', 'SPARSE'],
      ...['-fs', 'Case-sensitive APFS', '-volname', 'Eien case', image],
    ]);
    await run('hdiutil', [
      'attach',
      '-quiet',
      '-nobrowse',
      '-mountpoint',
      root,
      `${image}.sparseimage`,
    ]);
    close = async () => {
      await run('hdiutil', ['detach', '-quiet', '-force', root]).catch(() => undefined);
      await removeBase();
    };
  }
  return { folder: () => mkdtemp(join(root, 'vault-')), close };
}
