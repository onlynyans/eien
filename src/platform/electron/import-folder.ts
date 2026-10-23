// Import a folder of Markdown from elsewhere into the open vault (spec §8):
// its files listed and read without following a link (./outside-folder.ts),
// the plan made by core/import,
// each note read and written through the vault's storage only where nothing
// is, so nothing is ever written over; the original is only read.

import { readdir, realpath } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  type Copy,
  type ImportReport,
  type LeftOut,
  type LeftReason,
  planImport,
} from '../../core/import';
import { baseName, extensionOf, freeName, parentOf } from '../../core/paths';
import { MAX_NOTE_BYTES } from '../index/vault-index';
import type { OpenVault } from '../open-vault';
import { MAX_BYTES_READ } from '../storage';
import { listFolder, readNoLinks, within } from './outside-folder';

/** Thrown when the folder chosen can't be imported at all (it's the vault, in it, or holds it). */
export class ImportRefused extends Error {}

/** Notes read and written at once. */
const AT_ONCE = 8;
/** Names tried for a note when something arrived at its name meanwhile. */
const TRIES = 5;

const utf8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Copy the notes and images in `source` (a folder outside the vault at
 * `vaultRoot`) into a new folder at the top of `vault`. `writing` hears that
 * folder's name before anything is written to it.
 */
export async function importFolder(
  source: string,
  vaultRoot: string,
  vault: OpenVault,
  writing: (folder: string) => void = () => {},
): Promise<ImportReport> {
  const from = await realpath(source);
  const to = await realpath(vaultRoot);
  if ((await within(from, to)) || (await within(to, from))) {
    throw new ImportRefused('That folder is the vault, is in it, or holds it.');
  }
  const listed = await listFolder(from);
  // The vault's top as the disk has it now (links and hidden names too), not as the index last read it.
  const top = await readdir(to);
  const limits = { note: MAX_NOTE_BYTES, image: MAX_BYTES_READ } as const;
  const plan = planImport(listed.files, basename(source), top, limits);
  if (plan.folder) writing(plan.folder);
  const left: LeftOut[] = [...listed.left, ...plan.left];
  const written: Copy[] = [];

  type Outcome<T> =
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly why: LeftReason };
  const fail = (why: LeftReason) => ({ ok: false, why }) as const;
  /** The file's bytes (a note's as UTF-8 text), or why it can't come in. */
  const read = async (copy: Copy): Promise<Outcome<Uint8Array | string>> => {
    const bytes = await readNoLinks(from, copy.from, limits[copy.kind]);
    if (bytes === 'link' || bytes === 'too-large') return fail(bytes);
    if (!bytes) return fail('unreadable');
    if (copy.kind === 'image') return { ok: true, value: bytes };
    try {
      return { ok: true, value: utf8.decode(bytes) }; // a byte-order mark kept, as the note had it
    } catch {
      return fail('not-utf8');
    }
  };
  /** Write it where nothing is: at `to`, or the next free name when something arrived there. */
  const write = async (to: string, data: Uint8Array | string): Promise<Outcome<string>> => {
    const name = baseName(to);
    const extension = extensionOf(name);
    let target = to;
    for (let tries = 0; tries < TRIES; tries++) {
      const done = await (typeof data === 'string'
        ? vault.storage.write(target, data, null).then((result) => result.ok)
        : vault.storage.writeNew(target, data)
      ).catch(() => null);
      if (done === null) return fail('unwritten');
      if (done) return { ok: true, value: target };
      // Another device (Syncthing) wrote there meanwhile: kept, and this one numbered.
      const folder = parentOf(to);
      const names = [...(await vault.storage.listFiles(folder)), baseName(target)];
      target = `${folder}/${freeName(name.slice(0, name.length - extension.length), names, extension)}`;
    }
    return fail('taken');
  };
  const copy = async (file: Copy) => {
    const data = await read(file);
    const done = data.ok ? await write(file.to, data.value) : data;
    if (done.ok) written.push({ ...file, to: done.value });
    else left.push({ path: file.from, reason: done.why });
  };

  const queue = [...plan.copies];
  const workers = Array.from({ length: AT_ONCE }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) await copy(next);
  });
  await Promise.all(workers);
  const paths = written.map((each) => each.to);
  if (paths.length) await vault.index.refresh(paths).catch(() => undefined); // the watcher catches up
  const order = (a: LeftOut, b: LeftOut) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return {
    folder: written.length ? plan.folder : null,
    copied: written.filter((each) => each.kind === 'note').length,
    images: written.filter((each) => each.kind === 'image').length,
    left: left.sort(order),
  };
}
