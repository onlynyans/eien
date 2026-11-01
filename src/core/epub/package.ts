// A book's package (#40): container.xml names it; it says what the book is
// (its title, author, language), what files it holds (the manifest), the
// order they're read in (the spine) and where its contents are (the nav, or
// an EPUB 2 book's NCX). A book locked with DRM is refused here, before any
// of its words are read.

import type { EpubCaps } from './caps';
import { type Refusal, refuse } from './refusal';
import { all, attr, childrenNamed, first, wordsOf, xmlOf } from './xml-nodes';
import { inZip } from './zip-path';
import type { ZipArchive } from './zip-read';

export interface ManifestItem {
  readonly id: string;
  /** Its path in the zip. */
  readonly path: string;
  readonly type: string;
  readonly properties: readonly string[];
}

export interface SpineItem {
  readonly path: string;
  /** A spine item marked linear="no" (a note, an answer) is read only when reached by a link. */
  readonly linear: boolean;
}

export interface Package {
  /** The package's own path: what its hrefs are relative to. */
  readonly path: string;
  readonly title: string;
  readonly author: string;
  readonly language: string;
  readonly manifest: ReadonlyMap<string, ManifestItem>;
  readonly spine: readonly SpineItem[];
  /** The EPUB 3 nav document's path, if the book has one. */
  readonly nav: string | null;
  /** The EPUB 2 NCX's path, if the book has one. */
  readonly ncx: string | null;
}

const CONTAINER = 'META-INF/container.xml';
const PACKAGE_TYPE = 'application/oebps-package+xml';
const NCX_TYPE = 'application/x-dtbncx+xml';

/** Fonts obfuscated so they travel only with their book: not DRM, and Eien never reads a book's fonts. */
const FONT_OBFUSCATION = new Set([
  'http://www.idpf.org/2008/embedding',
  'http://ns.adobe.com/pdf/enc#RC',
]);

/** Adobe's rights file, Apple's and Readium LCP's licence: their books are locked whatever the rest says. */
const LOCKS = ['META-INF/rights.xml', 'META-INF/sinf.xml', 'META-INF/license.lcpl'];

/** Why the book is locked, or null: encryption.xml naming anything but an obfuscated font. */
async function lock(zip: ZipArchive, caps: EpubCaps): Promise<Refusal | null> {
  const locked = LOCKS.find((name) => zip.has(name));
  if (locked) return refuse('locked', `${locked} is there`);
  if (!zip.has('META-INF/encryption.xml')) return null;
  const bytes = await zip.read('META-INF/encryption.xml', caps.text);
  if (!(bytes instanceof Uint8Array)) return bytes;
  const methods = all(xmlOf(bytes), 'encryptionmethod').map((node) => attr(node, 'algorithm'));
  const drm = methods.find((method) => !FONT_OBFUSCATION.has(method));
  return drm === undefined
    ? null
    : refuse('locked', `encrypted with ${drm || 'no algorithm named'}`);
}

/** The words of the first `name` in `metadata`, or ''. */
const meta = (metadata: ReturnType<typeof first>, name: string): string => {
  const node = metadata ? first(metadata.children, name) : null;
  return node ? wordsOf(node) : '';
};

/** The book's package, read from `zip`, or why it won't be. */
export async function readPackage(zip: ZipArchive, caps: EpubCaps): Promise<Package | Refusal> {
  if (!zip.has(CONTAINER)) return refuse('not-epub', `no ${CONTAINER}`);
  const locked = await lock(zip, caps);
  if (locked) return locked;
  const container = await zip.read(CONTAINER, caps.text);
  if (!(container instanceof Uint8Array)) return container;
  const rootfiles = all(xmlOf(container), 'rootfile');
  const rootfile =
    rootfiles.find((node) => attr(node, 'media-type') === PACKAGE_TYPE) ?? rootfiles[0];
  const path = rootfile ? inZip('', attr(rootfile, 'full-path'))?.path : undefined;
  if (!path || !zip.has(path)) return refuse('not-epub', 'container.xml names no package');
  const bytes = await zip.read(path, caps.text);
  if (!(bytes instanceof Uint8Array)) return bytes;
  const opf = xmlOf(bytes);

  const manifest = new Map<string, ManifestItem>();
  for (const item of all(opf, 'item')) {
    const id = attr(item, 'id');
    const href = inZip(path, attr(item, 'href'));
    // An item outside the zip, or one named twice, is no file of the book's.
    if (!id || !href || manifest.has(id)) continue;
    manifest.set(id, {
      id,
      path: href.path,
      type: attr(item, 'media-type').trim().toLowerCase(),
      properties: attr(item, 'properties').split(/\s+/u).filter(Boolean),
    });
  }
  const spineNode = first(opf, 'spine');
  const spine = (spineNode ? childrenNamed(spineNode, 'itemref') : []).flatMap((ref) => {
    const item = manifest.get(attr(ref, 'idref'));
    return item && zip.has(item.path)
      ? [{ path: item.path, linear: attr(ref, 'linear').trim() !== 'no' }]
      : [];
  });
  if (spine.length === 0) return refuse('empty', 'the spine names no file the zip holds');

  const items = [...manifest.values()];
  const nav = items.find((item) => item.properties.includes('nav'))?.path ?? null;
  const tocId = spineNode ? attr(spineNode, 'toc') : '';
  const ncx =
    manifest.get(tocId)?.path ?? items.find((item) => item.type === NCX_TYPE)?.path ?? null;
  const metadata = first(opf, 'metadata');
  return {
    path,
    title: meta(metadata, 'title'),
    author: meta(metadata, 'creator'),
    language: meta(metadata, 'language'),
    manifest,
    spine,
    nav: nav && zip.has(nav) ? nav : null,
    ncx: ncx && zip.has(ncx) ? ncx : null,
  };
}
