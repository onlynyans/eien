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
  sync: '<path d="M12.8 6.3A5 5 0 0 0 3.6 5"/><path d="M3.2 9.7a5 5 0 0 0 9.2 1.3"/><path d="M13 3.2v3.3H9.7M3 12.8V9.5h3.3"/>',
  search: '<circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2l3.3 3.3"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  sort: '<path d="M2.5 4.5h11M4.5 8h7M6.5 11.5h3"/>',
  strip: '<path d="M2.5 3h11v10h-11z"/><path d="M2.5 6h11"/>',
  format: '<path d="M3.5 12.5L7 3.5h2l3.5 9"/><path d="M5 9h6"/>',
  link: '<path d="M6.8 9.2l2.4-2.4"/><path d="M8.6 5l1.2-1.2a2.4 2.4 0 0 1 3.4 3.4L12 8.4"/><path d="M7.4 11l-1.2 1.2a2.4 2.4 0 0 1-3.4-3.4L4 7.6"/>',
  quote: '<path d="M3 8.5h3.5v4H3zM3 8.5c0-2.5.8-4 3-5M9.5 8.5H13v4H9.5zM9.5 8.5c0-2.5.8-4 3-5"/>',
  bullets:
    '<path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5"/><circle cx="3.2" cy="4.5" r=".6"/><circle cx="3.2" cy="8" r=".6"/><circle cx="3.2" cy="11.5" r=".6"/>',
  numbers:
    '<path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7"/><path d="M2.5 3.5l1-.7v3.2M2.4 9.2c.2-.6 1.6-.7 1.6.2 0 .7-1.6 1.2-1.6 1.8h1.7"/>',
  checklist:
    '<path d="M2.5 3h3.5v3.5H2.5zM2.5 9.5h3.5V13H2.5z"/><path d="M3.3 11.2l.9.9 1.4-1.8M8.5 4.8h5M8.5 11.2h5"/>',
  highlight: '<path d="M9.5 2.8l3.7 3.7-5.6 5.6H3.9V8.4z"/><path d="M2.5 13.8h11"/>',
  heading: '<path d="M3.5 3v10M10.5 3v10M3.5 8h7"/><path d="M12.5 13v-3.5l1-.5"/>',
  grip: '<circle cx="6" cy="4" r=".7"/><circle cx="10" cy="4" r=".7"/><circle cx="6" cy="8" r=".7"/><circle cx="10" cy="8" r=".7"/><circle cx="6" cy="12" r=".7"/><circle cx="10" cy="12" r=".7"/>',
  more: '<circle cx="3.5" cy="8" r=".8"/><circle cx="8" cy="8" r=".8"/><circle cx="12.5" cy="8" r=".8"/>',
  outdent: '<path d="M7 4.5L3.5 8 7 11.5"/><path d="M3.5 8h10"/><path d="M13.5 3v10"/>',
  filter: '<path d="M2.5 3.5h11l-4.3 5.2v4l-2.4 1.3V8.7z"/>',
  check: '<path d="M3 8.5l3 3 7-7"/>',
  back: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
  folder: '<path d="M2.5 4.5h4l1.2 1.5h5.8v6.5h-11z"/>',
  palette:
    '<path d="M8 2.5a5.5 5.5 0 1 0 0 11c1 0 1.3-.7.9-1.5-.5-1 .1-1.8 1.1-1.8h1.4c1.3 0 2.1-.9 2.1-2.2 0-3-2.5-5.5-5.5-5.5z"/><circle cx="5.2" cy="7" r=".7"/><circle cx="7.5" cy="5" r=".7"/><circle cx="10.4" cy="5.6" r=".7"/>',
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
  resize: '<path d="M13 7l-6 6M13 10.5L10.5 13"/>',
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
