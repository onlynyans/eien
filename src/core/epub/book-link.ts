// A link inside a book (#40, Phase 2b): the address a chapter's link is given
// on the page when it lands on one of the book's own chapters, and read back
// when it's followed. An address of the page's own ("#…"), so a click can
// never take the window anywhere, prefixed so no name a book gives is taken
// for one of the window's, and every part escaped. Anything else a link
// names (the web, mail, a file that isn't a chapter) keeps only its words.

import { isZipPath, type ZipAddress } from './zip-path';

const PREFIX = '#book/';

/** The page's address for `link`: a chapter's path in the zip, and the place in it. */
export const bookHref = (link: ZipAddress): string =>
  `${PREFIX}${encodeURIComponent(link.path)}${link.fragment ? `:${encodeURIComponent(link.fragment)}` : ''}`;

/** The chapter and place `href` names, if it's a book's own address; null for anything else. */
export function bookLinkOf(href: string): ZipAddress | null {
  if (!href.startsWith(PREFIX)) return null;
  const parts = href.slice(PREFIX.length).split(':');
  if (parts.length > 2) return null;
  try {
    const path = decodeURIComponent(parts[0] ?? '');
    const fragment = decodeURIComponent(parts[1] ?? '');
    return isZipPath(path) && !path.endsWith('/') ? { path, fragment } : null;
  } catch {
    return null; // a stray "%"
  }
}
