// Eien's own icons (docs/design/explorations/specimen.md): drawn on a 16-unit
// grid with round ends and joins, stroked in the ink of whatever they sit in.
// Inline SVG, so nothing is fetched and there's no icon font. Each is the
// inside of an <svg viewBox="0 0 16 16">, the names and paths as the design
// pass drew them (explorations/_src/shared.js).

export const ICONS = {
  live: '<path d="M10.6 2.9l2.5 2.5-7.3 7.3-3.2.8.8-3.2z"/><path d="M9.2 4.3l2.5 2.5"/><path d="M8.5 13.5h5"/>',
  source:
    '<path d="M5.5 4.5L2 8l3.5 3.5"/><path d="M10.5 4.5L14 8l-3.5 3.5"/><path d="M9.2 3l-2.4 10"/>',
  reading:
    '<path d="M8 4.6C6.6 3.6 4.7 3.1 2.2 3.1v9.4c2.5 0 4.4.5 5.8 1.5 1.4-1 3.3-1.5 5.8-1.5V3.1c-2.5 0-4.4.5-5.8 1.5z"/><path d="M8 4.6V14"/>',
  // A book's two ways to read (#40, Phase 3b): a page with its corner, and a sheet that scrolls.
  pages: '<path d="M3.5 2.5h6l3 3v8h-9z"/><path d="M9.5 2.5v3h3"/>',
  scroll: '<path d="M4.5 2.5h7v11h-7z"/><path d="M8 5.5v5M6.5 7L8 5.5 9.5 7M6.5 9L8 10.5 9.5 9"/>',
  // A book's bookmark (#40, Phase 4b): a page with the silk ribbon over its top edge, its end
  // forked, as the Page mark's; the page tells it from Pinned's banner.
  bookmark: '<path d="M3.5 2.5h9v11h-9z"/><path d="M8.5 2.5v5.5l1.5-1.5 1.5 1.5V2.5"/>',
  // A book's marks (#64): the list's lines, the bookmark's ribbon beside them: what you kept.
  marks: '<path d="M2.5 4.5h6M2.5 8h6M2.5 11.5h4"/><path d="M10.5 2.5h3v10l-1.5-1.5-1.5 1.5z"/>',
  compare:
    '<path d="M2.5 3h4.5v10H2.5z"/><path d="M9 3h4.5v10H9z"/><path d="M4 6h1.5M4 8.5h1.5M10.5 6h1.5M10.5 8.5h1.5M10.5 11h1.5"/>',
  versions: '<path d="M4.5 2.5h8v9.5"/><path d="M2.5 4.5h8v9h-8z"/><path d="M4.5 7.5h4M4.5 10h3"/>',
  sidebar: '<path d="M2.5 3h11v10h-11z"/><path d="M6.5 3v10"/>',
  list: '<path d="M2.5 3h11v10h-11z"/><path d="M6.5 3v10"/><path d="M8.5 6h3M8.5 8.5h3M8.5 11h2"/>',
  panes3: '<path d="M2 3h12v10H2z"/><path d="M5.5 3v10M9 3v10"/>',
  panes2: '<path d="M2 3h12v10H2z"/><path d="M6 3v10"/>',
  left: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
  right: '<path d="M6 3.5l4.5 4.5L6 12.5"/>',
  up: '<path d="M3.5 10L8 5.5l4.5 4.5"/>',
  down: '<path d="M3.5 6L8 10.5 12.5 6"/>',
  sun: '<circle cx="8" cy="8" r="2.6"/><path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1"/>',
  moon: '<path d="M13.2 9.6A5.4 5.4 0 1 1 6.4 2.8a4.3 4.3 0 0 0 6.8 6.8z"/>',
  settings: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/><path d="M5.5 3v3M10.5 6.5v3M7 10v3"/>',
  plus: '<path d="M8 3.5v9M3.5 8h9"/>',
  tag: '<path d="M6.2 2.5L4.8 13.5M11.2 2.5L9.8 13.5M3 5.8h10.5M2.5 10.2H13"/>',
  pin: '<path d="M4.5 2.5h7v11L8 11l-3.5 2.5z"/>',
  window: '<path d="M2.5 4h9v8.5h-9z"/><path d="M5 4V2.5h8.5V10H11.5"/>',
  split: '<path d="M2.5 3.5h11v9h-11z"/><path d="M8 3.5v9"/>',
  sync: '<path d="M12.8 6.3A5 5 0 0 0 3.6 5"/><path d="M3.2 9.7a5 5 0 0 0 9.2 1.3"/><path d="M13 3.2v3.3H9.7M3 12.8V9.5h3.3"/>',
  search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.3 3.3"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  copy: '<path d="M5.5 5.5h8v8h-8z"/><path d="M10.5 5.5v-3h-8v8h3"/>',
  sort: '<path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3"/>',
  strip: '<path d="M2.5 3h11v10h-11z"/><path d="M2.5 6h11"/>',
  format: '<path d="M3.5 12.5L7 3.5h2l3.5 9"/><path d="M5 9h6"/>',
  link: '<path d="M6.8 9.2l2.4-2.4"/><path d="M8.6 5l1.2-1.2a2.4 2.4 0 0 1 3.4 3.4L12 8.4"/><path d="M7.4 11l-1.2 1.2a2.4 2.4 0 0 1-3.4-3.4L4 7.6"/>',
  // A link's (backlog #38, explorations/_src/link.js): follow it, take it off, a note's, the web's.
  openLink: '<path d="M9.5 2.5h4v4"/><path d="M13.5 2.5L8 8"/><path d="M11.5 9.5v4h-9v-9h4"/>',
  unlink:
    '<path d="M8.6 5l1.2-1.2a2.4 2.4 0 0 1 3.4 3.4L12 8.4"/><path d="M7.4 11l-1.2 1.2a2.4 2.4 0 0 1-3.4-3.4L4 7.6"/><path d="M3 3l1.6 1.6M13 13l-1.6-1.6"/>',
  note: '<path d="M4 2.5h5.5L12 5v8.5H4z"/><path d="M9.5 2.5V5H12"/><path d="M6 8h4M6 10.5h3"/>',
  web: '<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11"/><path d="M8 2.5c1.5 1.6 2.3 3.4 2.3 5.5S9.5 11.9 8 13.5C6.5 11.9 5.7 10.1 5.7 8S6.5 4.1 8 2.5z"/>',
  quote: '<path d="M3 8.5h3.5v4H3zM3 8.5c0-2.5.8-4 3-5M9.5 8.5H13v4H9.5zM9.5 8.5c0-2.5.8-4 3-5"/>',
  bullets:
    '<path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5"/><circle cx="3.2" cy="4.5" r=".6"/><circle cx="3.2" cy="8" r=".6"/><circle cx="3.2" cy="11.5" r=".6"/>',
  numbers:
    '<path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7"/><path d="M2.5 3.5l1-.7v3.2M2.4 9.2c.2-.6 1.6-.7 1.6.2 0 .7-1.6 1.2-1.6 1.8h1.7"/>',
  checklist:
    '<path d="M2.5 3h3.5v3.5H2.5zM2.5 9.5h3.5V13H2.5z"/><path d="M3.3 11.2l.9.9 1.4-1.8M8.5 4.8h5M8.5 11.2h5"/>',
  table: '<path d="M2.5 3h11v10h-11z"/><path d="M2.5 6.3h11M2.5 9.7h11M8 3v10"/>',
  highlight: '<path d="M9.5 2.8l3.7 3.7-5.6 5.6H3.9V8.4z"/><path d="M2.5 13.8h11"/>',
  // The table editor's (explorations/_src/table.js): a row or column added on a side, one removed, the alignments.
  rowAbove:
    '<path d="M2.5 8.5h11v5h-11z"/><path d="M2.5 11h11" opacity=".45"/><path d="M8 1.8v4.4M5.8 4h4.4"/>',
  rowBelow:
    '<path d="M2.5 2.5h11v5h-11z"/><path d="M2.5 5h11" opacity=".45"/><path d="M8 9.8v4.4M5.8 12h4.4"/>',
  colLeft:
    '<path d="M8.5 2.5h5v11h-5z"/><path d="M11 2.5v11" opacity=".45"/><path d="M4 5.8v4.4M1.8 8h4.4"/>',
  colRight:
    '<path d="M2.5 2.5h5v11h-5z"/><path d="M5 2.5v11" opacity=".45"/><path d="M12 5.8v4.4M9.8 8h4.4"/>',
  rowDelete: '<path d="M2.5 5h11v6h-11z"/><path d="M6.8 6.8l2.4 2.4M9.2 6.8l-2.4 2.4"/>',
  colDelete: '<path d="M5 2.5h6v11H5z"/><path d="M6.8 6.8l2.4 2.4M9.2 6.8l-2.4 2.4"/>',
  alignLeft: '<path d="M2.5 4h11M2.5 7h7M2.5 10h11M2.5 13h7"/>',
  alignCenter: '<path d="M2.5 4h11M4.5 7h7M2.5 10h11M4.5 13h7"/>',
  alignRight: '<path d="M2.5 4h11M6.5 7h7M2.5 10h11M6.5 13h7"/>',
  gripColumn:
    '<circle cx="4" cy="6" r=".7"/><circle cx="4" cy="10" r=".7"/><circle cx="8" cy="6" r=".7"/><circle cx="8" cy="10" r=".7"/><circle cx="12" cy="6" r=".7"/><circle cx="12" cy="10" r=".7"/>',
  heading: '<path d="M3.5 3v10M10.5 3v10M3.5 8h7"/><path d="M12.5 13v-3.5l1-.5"/>',
  grip: '<circle cx="6" cy="4" r=".7"/><circle cx="10" cy="4" r=".7"/><circle cx="6" cy="8" r=".7"/><circle cx="10" cy="8" r=".7"/><circle cx="6" cy="12" r=".7"/><circle cx="10" cy="12" r=".7"/>',
  more: '<circle cx="3.5" cy="8" r=".8"/><circle cx="8" cy="8" r=".8"/><circle cx="12.5" cy="8" r=".8"/>',
  outdent: '<path d="M7 4.5L3.5 8 7 11.5"/><path d="M3.5 8h10"/><path d="M13.5 3v10"/>',
  filter: '<path d="M2.5 3.5h11l-4.3 5.2v4l-2.4 1.3V8.7z"/>',
  check: '<path d="M3 8.5l3 3 7-7"/>',
  back: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
  folder: '<path d="M2.5 4.5h4l1.2 1.5h5.8v6.5h-11z"/>',
  // A folder's notes and, indented under it, its subfolders' (the list's Include subfolders).
  subfolders:
    '<path d="M2.5 3.5h7"/><path d="M4.5 3.5v8.5h2M4.5 8h2"/><path d="M8.5 8h5M8.5 12h5"/>',
  palette:
    '<path d="M8 2.5a5.5 5.5 0 1 0 0 11c1 0 1.3-.7.9-1.5-.5-1 .1-1.8 1.1-1.8h1.4c1.3 0 2.1-.9 2.1-2.2 0-3-2.5-5.5-5.5-5.5z"/><circle cx="5.2" cy="7" r=".7"/><circle cx="7.5" cy="5" r=".7"/><circle cx="10.4" cy="5.6" r=".7"/>',
  // The quick look (#49): a capital and a small letter, as a type specimen opens, in a serif (#73),
  // as the page's own face is: foot serifs under the A, and a two-storey a, its arch hooked at its
  // end and its stem tailed. Find's Match case keeps the sans Aa, so the two never read as one.
  look: '<path d="M2 13L4.7 3.4h.6L8 13M3.1 9.6h4"/><path d="M1.2 13h1.6M7.2 13h1.6"/><path d="M10.7 9.7c-.1-1 .7-1.7 1.7-1.7 1.1 0 1.8.6 1.8 1.7v2.7c0 .4.3.6.7.6"/><path d="M14.2 10.4c-2.3 0-3.6.6-3.6 1.6 0 .6.5 1 1.2 1 1.3 0 2.4-.6 2.4-1.6"/>',
  type: '<path d="M3 4.5V3h10v1.5M8 3v10M6.2 13h3.6"/>',
  bold: '<path d="M4.5 2.8h4.2a2.6 2.6 0 0 1 0 5.2H4.5z"/><path d="M4.5 8h4.9a2.6 2.6 0 0 1 0 5.2H4.5z"/><path d="M4.5 2.8v10.4"/>',
  italic: '<path d="M7.2 2.8h5M3.8 13.2h5M10 2.8L6 13.2"/>',
  underline: '<path d="M4.5 2.8v4.6a3.5 3.5 0 0 0 7 0V2.8"/><path d="M3.5 13.5h9"/>',
  strike:
    '<path d="M2.5 8h11"/><path d="M11.2 4.4c-.6-1-1.8-1.6-3.2-1.6-1.8 0-3.2 1-3.2 2.4 0 .9.5 1.6 1.6 2.1"/><path d="M5 11.4c.6 1.1 1.8 1.8 3.3 1.8 1.9 0 3.3-1 3.3-2.5 0-.6-.2-1.1-.6-1.5"/>',
  focus:
    '<path d="M2.5 4h11" opacity=".35"/><path d="M2.5 8h11"/><path d="M2.5 12h8" opacity=".35"/><path d="M1 6v4M15 6v4"/>',
  rename: '<path d="M3 11.5h6.5"/><path d="M11.5 3v10M10 3h3M10 13h3"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>',
  move: '<path d="M2.5 4.5h4l1.2 1.5h5.8v6.5h-11z"/><path d="M6.5 9.5h4M9 8l1.5 1.5L9 11"/>',
  include: '<path d="M8 4v8M4 8h8"/>',
  exclude: '<path d="M4 8h8"/>',
  swap: '<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8"/><path d="M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>',
  resize: '<path d="M13 7l-6 6M13 10.5L10.5 13"/>',
  // Find's (ui/find/find-bar.ts): its three options, and a line put in another's place, once or all.
  matchCase:
    '<path d="M1.8 12.5L4.9 3.5h.6l3.1 9M3 9.5h4.4"/><circle cx="12" cy="10.3" r="2.2"/><path d="M14.2 8v4.5"/>',
  wholeWord:
    '<path d="M2 11.2v1.8h12v-1.8"/><circle cx="5" cy="7.3" r="2"/><path d="M7 5.3v4M9 3v6.3"/><circle cx="11" cy="7.3" r="2"/>',
  pattern:
    '<circle cx="4" cy="12" r=".9"/><path d="M11 2.8v5.4M8.7 4.2l4.6 2.6M13.3 4.2l-4.6 2.6"/>',
  replace: '<path d="M2.5 4h7"/><path d="M2.5 12h7"/><path d="M12.5 4v7.5M10.5 9.5l2 2 2-2"/>',
  replaceAll:
    '<path d="M2.5 3h7M2.5 5.5h7"/><path d="M2.5 10.5h7M2.5 13h7"/><path d="M12.5 3v9.5M10.5 10.5l2 2 2-2"/>',
} as const;

export type IconName = keyof typeof ICONS;

const SVG = 'http://www.w3.org/2000/svg';

/** An icon, stroked in currentColor; decorative, as its control carries the name. */
export function icon(name: IconName): SVGSVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset.icon = name;
  // The paths are this module's own constants, never anything a note holds.
  svg.innerHTML = ICONS[name];
  return svg;
}
