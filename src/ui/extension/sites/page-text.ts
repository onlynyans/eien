// Reading a site's page: an element's words, its HTML with every address made
// whole (a site's links are written from its own root, and the story page
// is elsewhere), and a list's items.

/** The words of `element`, its runs of space as one, or '' when there's none. */
export const wordsOf = (element: Element | null | undefined): string =>
  (element?.textContent ?? '').replace(/\s+/gu, ' ').trim();

/** The words of each of `elements`, the empty left out. */
export const wordsOfAll = (elements: Iterable<Element>): string[] =>
  [...elements].map(wordsOf).filter(Boolean);

/** `element`'s HTML, its links and images addressed from `base`; '' when there's no element. */
export function htmlOf(element: Element | null | undefined, base: URL): string {
  if (!element) return '';
  const copy = element.cloneNode(true) as Element;
  for (const [selector, name] of [
    ['a[href]', 'href'],
    ['img[src]', 'src'],
  ] as const) {
    for (const each of copy.querySelectorAll(selector)) {
      const written = each.getAttribute(name) ?? '';
      try {
        each.setAttribute(name, new URL(written, base).href);
      } catch {
        each.removeAttribute(name);
      }
    }
  }
  return copy.innerHTML;
}

/** `path` on the site `at` is on: a whole address. */
export const onSite = (path: string, at: URL): string => new URL(path, at).href;
