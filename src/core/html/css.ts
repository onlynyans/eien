// A style attribute read for what it says about words (bold, italic, struck,
// underlined, raised, hidden, lines kept) — not as a browser lays it out.

/** A style attribute's declarations, by property; the last one of a property counts. */
export function declarations(style: string): Map<string, string> {
  const css = new Map<string, string>();
  for (const part of style.split(';')) {
    const colon = part.indexOf(':');
    if (colon < 0) continue;
    const value = part.slice(colon + 1).replace(/!\s*important\s*$/iu, '');
    css.set(part.slice(0, colon).trim().toLowerCase(), value.trim().toLowerCase());
  }
  return css;
}
