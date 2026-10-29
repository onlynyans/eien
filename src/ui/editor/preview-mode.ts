// Which preview the editor is in, and whether Live shows the marks on the
// caret's lines: read by Live's decorations and by its tables alike.

import { Facet } from '@codemirror/state';

export type PreviewMode = 'live' | 'reading';

/** Which preview the editor is in; absent, there's none (Source). */
export const previewMode = Facet.define<PreviewMode, PreviewMode | null>({
  combine: (values) => values[0] ?? null,
});

/**
 * Whether Live shows the Markdown marks on the lines the selection touches
 * (the "Show Markdown marks" setting, on unless said otherwise). Off, Live
 * hides them there too, as Reading does, and stays editable.
 */
export const showMarks = Facet.define<boolean, boolean>({
  combine: (values) => values[0] ?? true,
});

/**
 * Whether Live opens the caret's link where it stands, its marks shown
 * whatever "Show Markdown marks" says (backlog #38: the In place way of
 * showing a link, ./link-inline.ts).
 */
export const linkInPlace = Facet.define<boolean, boolean>({
  combine: (values) => values.some(Boolean),
});
