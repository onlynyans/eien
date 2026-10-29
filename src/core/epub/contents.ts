// A book's contents and its print pages (#40): from the EPUB 3 nav, else an
// EPUB 2 book's NCX, else one row for each file the spine reads. Each row
// knows which spine item it's in, so the list can mark the chapter on the
// page. The page-list (the printed edition's pages) is read now, kept for
// page numbers later (Phase 4).

import type { HtmlElement, HtmlNode } from '../html';
import type { Package } from './package';
import { all, attr, childrenNamed, first, wordsOf } from './xml-nodes';
import { inZip } from './zip-path';

export interface ContentsEntry {
  readonly title: string;
  /** The file it opens, in the zip, and the place in it ('' for its start). */
  readonly path: string;
  readonly fragment: string;
  /** 0 for a top row; a part's chapters are 1. */
  readonly depth: number;
  /** The spine item its file is. */
  readonly spine: number;
}

/** A page of the printed edition: its number as printed, and where it starts. */
export interface PrintPage {
  readonly label: string;
  readonly path: string;
  readonly fragment: string;
}

const types = (node: HtmlElement) => attr(node, 'type').split(/\s+/u);

/** The nav's own list of `type` ("toc", "page-list"), as rows with their depth. */
function navRows(nodes: readonly HtmlNode[], from: string, type: string) {
  const nav = all(nodes, 'nav').find((node) => types(node).includes(type));
  const rows: { title: string; href: string; depth: number }[] = [];
  const walk = (list: HtmlElement, depth: number) => {
    for (const item of childrenNamed(list, 'li')) {
      // A row's own link, or (a part's heading with no file of its own) its first chapter's.
      const own = item.children.find(
        (child): child is HtmlElement =>
          child.kind === 'element' && (child.name === 'a' || child.name === 'span'),
      );
      const link = own?.name === 'a' ? own : first(item.children, 'a');
      const title = own ? wordsOf(own) : '';
      if (link && title) rows.push({ title, href: attr(link, 'href'), depth });
      const inner = childrenNamed(item, 'ol')[0];
      if (inner) walk(inner, depth + 1);
    }
  };
  const list = nav ? childrenNamed(nav, 'ol')[0] : undefined;
  if (list) walk(list, 0);
  return rows.map((row) => ({ ...row, from }));
}

/** The NCX's navMap (or, for `pages`, its pageList), as rows with their depth. */
function ncxRows(nodes: readonly HtmlNode[], from: string, pages: boolean) {
  const rows: { title: string; href: string; depth: number; from: string }[] = [];
  const row = (point: HtmlElement, depth: number) => {
    const label = childrenNamed(point, 'navlabel')[0];
    const content = childrenNamed(point, 'content')[0];
    const title = label ? wordsOf(label) : '';
    if (content && title) rows.push({ title, href: attr(content, 'src'), depth, from });
  };
  if (pages) {
    const list = first(nodes, 'pagelist');
    for (const target of list ? all(list.children, 'pagetarget') : []) row(target, 0);
    return rows;
  }
  const walk = (parent: HtmlElement, depth: number) => {
    for (const point of childrenNamed(parent, 'navpoint')) {
      row(point, depth);
      walk(point, depth + 1);
    }
  };
  const map = first(nodes, 'navmap');
  if (map) walk(map, 0);
  return rows;
}

export interface ContentsSources {
  /** The nav document's nodes, and the NCX's, as the book has them. */
  readonly nav: readonly HtmlNode[] | null;
  readonly ncx: readonly HtmlNode[] | null;
}

/** Rows whose address is in the zip, each with the spine item it's in. */
function placed(
  pkg: Package,
  rows: readonly { title: string; href: string; depth: number; from: string }[],
): ContentsEntry[] {
  const spineOf = new Map(pkg.spine.map((item, i) => [item.path, i]));
  return rows.flatMap((row) => {
    const address = inZip(row.from, row.href);
    const spine = address ? spineOf.get(address.path) : undefined;
    return address && spine !== undefined
      ? [{ title: row.title, ...address, depth: row.depth, spine }]
      : [];
  });
}

/** The book's contents: the nav's, the NCX's, or one row per file the spine reads. */
export function contentsOf(pkg: Package, sources: ContentsSources): ContentsEntry[] {
  const fromNav = sources.nav && pkg.nav ? placed(pkg, navRows(sources.nav, pkg.nav, 'toc')) : [];
  if (fromNav.length > 0) return fromNav;
  const fromNcx = sources.ncx && pkg.ncx ? placed(pkg, ncxRows(sources.ncx, pkg.ncx, false)) : [];
  if (fromNcx.length > 0) return fromNcx;
  return pkg.spine.flatMap((item, spine) =>
    item.linear
      ? [{ title: `Section ${spine + 1}`, path: item.path, fragment: '', depth: 0, spine }]
      : [],
  );
}

/** The printed edition's pages, from the nav's page-list or the NCX's pageList; none without. */
export function printPagesOf(pkg: Package, sources: ContentsSources): PrintPage[] {
  const rows = sources.nav && pkg.nav ? navRows(sources.nav, pkg.nav, 'page-list') : [];
  const chosen =
    rows.length > 0 ? rows : sources.ncx && pkg.ncx ? ncxRows(sources.ncx, pkg.ncx, true) : [];
  return placed(pkg, chosen).map(({ title, path, fragment }) => ({ label: title, path, fragment }));
}
