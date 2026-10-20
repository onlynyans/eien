// Which URLs the window may show. The window only ever shows Eien's own page;
// web links open in the system browser; everything else is refused.

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function parse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** True when `url` is Eien's own page: same origin as `appUrl`, or for a
 * `file:` app, the same file. */
export function isAppUrl(url: string, appUrl: string): boolean {
  const target = parse(url);
  const app = parse(appUrl);
  if (!target || !app) return false;
  if (app.protocol === 'file:') {
    return target.protocol === 'file:' && target.pathname === app.pathname;
  }
  return target.origin === app.origin;
}

/** True when `url` may be handed to the system to open (browser, mail). */
export function isExternalLink(url: string): boolean {
  const target = parse(url);
  return target !== null && EXTERNAL_PROTOCOLS.has(target.protocol);
}
