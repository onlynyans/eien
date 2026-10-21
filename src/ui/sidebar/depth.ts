// How deep a row of the sidebar's tree sits: its indent and its guide line.

/** Sets a row's depth: through the style API, as the security policy refuses style attributes. */
export function atDepth<T extends HTMLElement>(item: T, depth: number): T {
  item.style.setProperty('--depth', String(depth));
  return item;
}
