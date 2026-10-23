// The panes' widths, and which are shut, remembered on this device (spec §2:
// per-device state stays out of the vault) in the window's own storage. Only
// the arithmetic is here; ./panes.ts draws it.

/** A width the writer can drag: the sidebar's (with three panes, and with two) and the note list's. */
export type Edge = 'sidebar' | 'sidebarTwo' | 'list';

export interface Panes {
  /** Widths in CSS pixels. With two panes the sidebar holds the notes, so it has its own. */
  readonly sidebar: number;
  readonly sidebarTwo: number;
  readonly list: number;
  readonly sidebarShut: boolean;
  readonly listShut: boolean;
}

/** Each width's narrowest and widest (docs/design). */
export const LIMITS: Readonly<Record<Edge, readonly [number, number]>> = {
  sidebar: [200, 420],
  sidebarTwo: [220, 520],
  list: [260, 480],
};

/** The tokens' widths (--eien-sidebar-w, --eien-list-w; two panes add --eien-space-7). */
export const DEFAULT_PANES: Panes = Object.freeze({
  sidebar: 264,
  sidebarTwo: 264 + 48,
  list: 316,
  sidebarShut: false,
  listShut: false,
});

/** In a narrow window the list, then the sidebar, give way until the page has this much. */
export const PAGE_MIN = 360;

/** One arrow key's step when a pane edge has the keyboard (--eien-space-4). */
export const STEP = 16;

const clamp = (edge: Edge, width: number) =>
  Math.round(Math.min(LIMITS[edge][1], Math.max(LIMITS[edge][0], width)));

/** The panes as stored; anything missing, mistyped or out of range is the default, or the limit. */
export function readPanes(text: string | null): Panes {
  let data: unknown;
  try {
    data = JSON.parse(text ?? '{}');
  } catch {
    return DEFAULT_PANES;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return DEFAULT_PANES;
  const stored = data as Record<string, unknown>;
  const width = (edge: Edge) => {
    const value = stored[edge];
    return typeof value === 'number' && Number.isFinite(value)
      ? clamp(edge, value)
      : DEFAULT_PANES[edge];
  };
  const flag = (key: 'sidebarShut' | 'listShut') =>
    typeof stored[key] === 'boolean' ? stored[key] : DEFAULT_PANES[key];
  return {
    sidebar: width('sidebar'),
    sidebarTwo: width('sidebarTwo'),
    list: width('list'),
    sidebarShut: flag('sidebarShut'),
    listShut: flag('listShut'),
  };
}

/** `panes` with `edge` dragged or stepped to `width`, kept within its limits. */
export function resized(panes: Panes, edge: Edge, width: number): Panes {
  return Number.isFinite(width) ? { ...panes, [edge]: clamp(edge, width) } : panes;
}

/**
 * `panes` with `edge` dragged (or stepped) `by` pixels from where it was:
 * `shown` wide on screen, which a narrow window may make less than what's
 * remembered. Narrower starts from what the writer sees, so the edge follows
 * the pointer; wider adds to what's remembered, so it's never left narrower
 * than it was, and a wider window shows the pane as wide as it was asked to be.
 */
export function dragged(panes: Panes, edge: Edge, shown: number, by: number): Panes {
  if (!Number.isFinite(by) || !Number.isFinite(shown)) return panes;
  return resized(panes, edge, by < 0 ? shown + by : Math.max(panes[edge], shown) + by);
}

/** The sidebar's own edge in this layout. */
export const sidebarEdge = (two: boolean): Edge => (two ? 'sidebarTwo' : 'sidebar');

/**
 * The widths the window shows: a shut sidebar is its `strip` (--strip, which
 * the layout and Shut sidebar make; none for the seal alone), the list is gone
 * when shut or with two panes, and in a window too narrow for all three the
 * list, then the sidebar, give way (not past their narrowest) to keep the
 * page PAGE_MIN wide. What's remembered doesn't change, so a wider window
 * gives the panes back.
 */
export function shownWidths(
  panes: Panes,
  two: boolean,
  window: number,
  strip: number,
): { readonly sidebar: number; readonly list: number } {
  const edge = sidebarEdge(two);
  // Read from the window's styles: anything but a length there is no strip.
  const shut = Number.isFinite(strip) ? Math.max(0, Math.round(strip)) : 0;
  let sidebar = panes.sidebarShut ? shut : panes[edge];
  let list = two || panes.listShut ? 0 : panes.list;
  let over = sidebar + list + PAGE_MIN - window;
  if (over > 0 && list > 0) {
    const give = Math.min(over, list - LIMITS.list[0]);
    list -= give;
    over -= give;
  }
  if (over > 0 && !panes.sidebarShut) sidebar -= Math.min(over, sidebar - LIMITS[edge][0]);
  return { sidebar, list };
}
