// A note's own folder of images ("Chapter 3.assets", core/vault/assets.ts)
// goes where the note goes: renamed or moved beside it, its links following,
// and to the trash with it. Where the folder can't go, it stays where it is,
// and the writer is told where the images are; nothing is lost.

import { baseName } from '../../core/paths';
import { assetsFolderOf, fileTitleOf, relinkAssets } from '../../core/vault';
import type { MoveResult } from '../../platform/storage';
import { reasonOf } from '../reason';
import type { OrganizeContext } from './organize';

const nameOf = (path: string) => fileTitleOf(baseName(path)) || path;

/**
 * The note moved from `from` to `to`: its folder of images goes beside it
 * under its new name, and its links to them follow, as Eien's own edit.
 */
export async function moveAssets(ctx: OrganizeContext, from: string, to: string): Promise<void> {
  const [left, goes] = [assetsFolderOf(from), assetsFolderOf(to)];
  let moved: MoveResult;
  try {
    moved = await ctx.vault.move(left, goes);
  } catch {
    moved = { ok: false, reason: 'taken' };
  }
  if (!moved.ok) {
    // A note with no images has no folder: nothing to say.
    if (moved.reason !== 'missing')
      ctx.tell(`“${nameOf(to)}” moved, but its images stayed in “${baseName(left)}”.`);
    return;
  }
  if (baseName(left) === baseName(goes)) return; // the same name beside it: its links still find it
  const change = (text: string) => relinkAssets(text, from, to);
  const amended = await ctx.amendOpen?.(to, change);
  if (amended === true || (amended == null && (await rewrite(ctx, to, change)))) return;
  ctx.tell(
    `The images in “${nameOf(to)}” are now in “${baseName(goes)}”, but its links to them couldn’t be changed.`,
  );
}

/** Change the words of the note at `path` on disk, through the version check; whether it was done. */
async function rewrite(
  ctx: OrganizeContext,
  path: string,
  change: (text: string) => string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const file = await ctx.vault.read(path);
    if (!file) return false;
    const next = change(file.text);
    if (next === file.text) return true;
    if ((await ctx.vault.write(path, next, file.version)).ok) return true;
  }
  return false;
}

/** The note at `path` went to the trash: its images go too. What to tell the writer. */
export async function trashAssets(ctx: OrganizeContext, path: string): Promise<string> {
  const assets = assetsFolderOf(path);
  const trashed = `“${nameOf(path)}” is in ${ctx.trashName}.`;
  if (!path.endsWith('.md') || !ctx.state.has(assets)) return trashed;
  try {
    await ctx.vault.trash(assets);
    return `“${nameOf(path)}” and its images are in ${ctx.trashName}.`;
  } catch (error) {
    return `${trashed} Its images stayed in “${baseName(assets)}”: ${reasonOf(error)}`;
  }
}
