// A note's own images (spec §2): an image dropped or pasted into a note is
// kept in a folder beside it named for it, "Chapter 3.md" → "Chapter 3.assets",
// and linked from the note relative to it. The folder belongs to the note: it
// isn't shown as a folder of its own, and goes where the note goes.

import { baseName, joinPath, parentOf, resolveLinkPath, safeName, titleOf } from '../paths';
import { imageTypeOf } from './entries';

export const ASSETS_SUFFIX = '.assets';

/** The folder holding the images of the note at `notePath`. */
export const assetsFolderOf = (notePath: string): string =>
  joinPath(parentOf(notePath), `${titleOf(baseName(notePath))}${ASSETS_SUFFIX}`);

/**
 * Whether the folder at `path` is a note's own: named "<title>.assets", beside
 * a note "<title>.md" (`isNote` says whether a path is one). One whose note
 * is gone is a folder like any other, so what's in it can still be found.
 */
export function isAssetsFolder(path: string, isNote: (path: string) => boolean): boolean {
  const name = baseName(path);
  if (!name.endsWith(ASSETS_SUFFIX) || name.length === ASSETS_SUFFIX.length) return false;
  const title = name.slice(0, -ASSETS_SUFFIX.length);
  return isNote(joinPath(parentOf(path), `${title}.md`));
}

/** A link's path as Markdown writes it: each part percent-encoded, brackets too. */
export const linkPathOf = (path: string): string =>
  path
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(
        /[()]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');

/** The link from the note at `notePath` to `name` in its own folder: "Chapter%203.assets/image.png". */
export const assetLinkOf = (notePath: string, name: string): string =>
  linkPathOf(`${baseName(assetsFolderOf(notePath))}/${name}`);

/** Extensions for a pasted image that came with no name, by its media type. */
const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
};

/**
 * The name an image arriving as `name` (of media type `type`) is kept
 * under, or null when it isn't an image a note shows. A pasted one often has
 * no name of its own ("image.png" at best): it's named for its kind.
 */
export function imageNameFor(name: string, type: string): string | null {
  const base = baseName(name.replace(/\\/g, '/'));
  if (imageTypeOf(base)) {
    const dot = base.lastIndexOf('.');
    return `${safeName(base.slice(0, dot), 'image', 200)}${base.slice(dot).toLowerCase()}`;
  }
  const extension = EXTENSIONS[type];
  return extension ? `image.${extension}` : null;
}

/** "image.png", then "image 2.png", "image 3.png"… for the `n`th try. */
export function numberedName(name: string, n: number): string {
  if (n <= 1) return name;
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} ${n}${name.slice(dot)}` : `${name} ${n}`;
}

/** A link's address in a note: in `](…)`, or after a reference's `[label]:`. */
const ADDRESS = /(\]\(\s*<?|^[ \t]{0,3}\[[^\]\n]+\]:[ \t]*<?)([^\s)>]+)/gmu;

/**
 * The note `text`, which moved from `from` to `to` with its images' folder,
 * its links into that folder pointing at the folder's new name. Every other
 * link stays as written.
 */
export function relinkAssets(text: string, from: string, to: string): string {
  const [oldFolder, newFolder] = [assetsFolderOf(from), assetsFolderOf(to)];
  if (baseName(oldFolder) === baseName(newFolder)) return text;
  return text.replace(ADDRESS, (whole, lead: string, address: string) => {
    const path = resolveLinkPath(parentOf(from), address);
    if (!path?.startsWith(`${oldFolder}/`)) return whole;
    const tail = address.match(/[?#].*$/u)?.[0] ?? '';
    const inside = path.slice(oldFolder.length + 1);
    return `${lead}${linkPathOf(`${baseName(newFolder)}/${inside}`)}${tail}`;
  });
}
