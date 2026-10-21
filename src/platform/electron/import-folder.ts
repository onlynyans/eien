// Import a folder of Markdown from elsewhere into the open vault (spec §8):
// its files listed and read without following a link (./outside-folder.ts),
// the plan made by core/import,
// each note read and written through the vault's storage only where nothing
// is, so nothing is ever written over; the original is only read.

import { readdir, realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import { type ImportReport, type LeftOut, type LeftReason, planImport } from '../../core/import';
import { baseName, freeNoteName, parentOf, titleOf } from '../../core/paths';
import { MAX_NOTE_BYTES } from '../index/vault-index';
import type { OpenVault } from '../open-vault';
import { listFolder, readNoLinks, within } from './outside-folder';

/** Thrown when the folder chosen can't be imported at all (it's the vault, in it, or holds it). */
export class ImportRefused extends Error {}

/** Notes read and written at once. */
const AT_ONCE = 8;
/** Names tried for a note when something arrived at its name meanwhile. */
const TRIES = 5;

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Copy the notes in `source` (a folder outside the vault at `vaultRoot`)
 * into a new folder at the top of `vault`.
 */
export async function importFolder(
  source: string,
  vaultRoot: string,
  vault: OpenVault,
): Promise<ImportReport> {
  const from = await realpath(source);
  const to = await realpath(vaultRoot);
  if ((await within(from, to)) || (await within(to, from))) {
    throw new ImportRefused('That folder is the vault, is in it, or holds it.');
  }
  const listed = await listFolder(from);
  // The vault's top as the disk has it now (links and hidden names too), not as the index last read it.
  const top = await readdir(to);
  const plan = planImport(listed.files, basename(source), top, MAX_NOTE_BYTES);
  const left: LeftOut[] = [...listed.left, ...plan.left];
  const written: string[] = [];

  type Outcome<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly why: LeftReason };
  const fail = (why: LeftReason) => ({ ok: false, why }) as const;
  /** The note's text, or why it can't come in. */
  const read = async (path: string): Promise<Outcome<string>> => {
    const bytes = await readNoLinks(from, path);
    if (bytes === 'link') return fail('link');
    if (!bytes) return fail('unreadable');
    if (bytes.length > MAX_NOTE_BYTES) return fail('too-large'); // grown since it was listed
    try {
      return { ok: true, value: utf8.decode(bytes) }; // a byte-order mark kept, as the note had it
    } catch {
      return fail('not-utf8');
    }
  };
  /** Write `text` where nothing is: at `to`, or the next free name when something arrived there. */
  const write = async (to: string, text: string): Promise<Outcome<string>> => {
    let target = to;
    for (let tries = 0; tries < TRIES; tries++) {
      const result = await vault.storage.write(target, text, null).catch(() => null);
      if (!result) return fail('unwritten');
      if (result.ok) return { ok: true, value: target };
      // Another device (Syncthing) wrote there meanwhile: kept, and this note numbered.
      const folder = parentOf(to);
      const names = [...(await vault.storage.listFiles(folder)), baseName(target)];
      target = `${folder}/${freeNoteName(titleOf(baseName(to)), names)}`;
    }
    return fail('taken');
  };
  const copy = async (file: { from: string; to: string }) => {
    const text = await read(file.from);
    const done = text.ok ? await write(file.to, text.value) : text;
    if (done.ok) written.push(done.value);
    else left.push({ path: file.from, reason: done.why });
  };

  const queue = [...plan.copies];
  const workers = Array.from({ length: AT_ONCE }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await copy(next);
  });
  await Promise.all(workers);
  if (written.length) await vault.index.refresh(written).catch(() => undefined); // the watcher catches up
  const order = (a: LeftOut, b: LeftOut) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return {
    folder: written.length ? plan.folder : null,
    copied: written.length,
    left: left.sort(order),
  };
}
