// Images dropped or pasted into a note (spec §4): each is copied into the
// note's own folder beside it, "Chapter 3.assets" (core/vault/assets.ts),
// under its own name or, where that's taken, the name numbered ("image 2.png");
// nothing there is ever written over. The note then links to it, relative to
// itself: ![](Chapter%203.assets/image.png).

import { joinPath } from '../../core/paths';
import {
  assetLinkOf,
  assetsFolderOf,
  imageNameFor,
  MAX_IMAGE_BYTES,
  numberedName,
} from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';
import { reasonOf } from '../reason';

/** How many numbered names to try before giving up on a name. */
const TRIES = 500;

const MEGABYTES = MAX_IMAGE_BYTES / (1024 * 1024);

/**
 * Copy `files` into the folder of the note at `notePath`; the Markdown that
 * shows the ones copied, a line each ("" for none). What couldn't be copied
 * is told, and why.
 */
export async function copyImages(
  vault: Pick<VaultBridge, 'writeNew'>,
  notePath: string,
  files: readonly File[],
  tell: (message: string) => void,
): Promise<string> {
  const folder = assetsFolderOf(notePath);
  const shown: string[] = [];
  for (const file of files) {
    const name = imageNameFor(file.name, file.type);
    if (!name) {
      tell(`“${file.name}” isn’t an image a note can show (PNG, JPEG, GIF, WebP, AVIF or SVG).`);
      continue;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      tell(`“${file.name}” is bigger than ${MEGABYTES} MB, the most a note shows.`);
      continue;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const kept = await keepAs(vault, folder, name, bytes);
      if (kept) shown.push(`![](${assetLinkOf(notePath, kept)})`);
      else tell(`“${file.name}” couldn’t be added: every name like it is taken.`);
    } catch (error) {
      tell(`“${file.name}” couldn’t be added: ${reasonOf(error)}`);
    }
  }
  return shown.join('\n');
}

/** Write `bytes` in `folder` as `name`, or the first numbered name free; the name used, or null. */
async function keepAs(
  vault: Pick<VaultBridge, 'writeNew'>,
  folder: string,
  name: string,
  bytes: Uint8Array,
): Promise<string | null> {
  for (let n = 1; n <= TRIES; n++) {
    const each = numberedName(name, n);
    if (await vault.writeNew(joinPath(folder, each), bytes)) return each;
  }
  return null;
}
