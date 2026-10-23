// Which notes the pages show, as a row marks it (spec §4): the active page's
// note is the chosen row (the selected fill and the seal's rule); while the
// window is split, the other page's note keeps a fainter rule, no fill.

export interface ShownNotes {
  readonly active: string | null;
  readonly other: string | null;
}

export const NONE_SHOWN: ShownNotes = { active: null, other: null };

/** A row's marks for the note at `path`, as attributes, the same for the list's rows and the tree's. */
export function shownAttrs(path: string, shown: ShownNotes): Record<string, string | undefined> {
  const beside = path === shown.other && path !== shown.active;
  return {
    'aria-current': path === shown.active ? 'true' : undefined,
    'data-beside': beside ? '' : undefined,
    'aria-description': beside ? 'On the other page' : undefined,
  };
}
