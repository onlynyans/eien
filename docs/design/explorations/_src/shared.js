// Shared by every exploration (inlined into each page by _build.py).

// Eien's icons: one set, drawn here on a 16-unit grid with round ends, stroked
// in the ink of whatever they sit in. No icon font, nothing fetched. Each is
// the inside of an <svg viewBox="0 0 16 16">.
const ICONS = {
  live: '<path d="M10.6 2.9l2.5 2.5-7.3 7.3-3.2.8.8-3.2z"/><path d="M9.2 4.3l2.5 2.5"/><path d="M8.5 13.5h5"/>',
  source: '<path d="M5.5 4.5L2 8l3.5 3.5"/><path d="M10.5 4.5L14 8l-3.5 3.5"/><path d="M9.2 3l-2.4 10"/>',
  reading: '<path d="M8 4.6C6.6 3.6 4.7 3.1 2.2 3.1v9.4c2.5 0 4.4.5 5.8 1.5 1.4-1 3.3-1.5 5.8-1.5V3.1c-2.5 0-4.4.5-5.8 1.5z"/><path d="M8 4.6V14"/>',
  compare: '<path d="M2.5 3h4.5v10H2.5z"/><path d="M9 3h4.5v10H9z"/><path d="M4 6h1.5M4 8.5h1.5M10.5 6h1.5M10.5 8.5h1.5M10.5 11h1.5"/>',
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
  bullets: '<path d="M6 4.5h7.5M6 8h7.5M6 11.5h7.5"/><circle cx="3.2" cy="4.5" r=".6"/><circle cx="3.2" cy="8" r=".6"/><circle cx="3.2" cy="11.5" r=".6"/>',
  numbers: '<path d="M6.5 4.5h7M6.5 8h7M6.5 11.5h7"/><path d="M2.5 3.5l1-.7v3.2M2.4 9.2c.2-.6 1.6-.7 1.6.2 0 .7-1.6 1.2-1.6 1.8h1.7"/>',
  checklist: '<path d="M2.5 3h3.5v3.5H2.5zM2.5 9.5h3.5V13H2.5z"/><path d="M3.3 11.2l.9.9 1.4-1.8M8.5 4.8h5M8.5 11.2h5"/>',
  highlight: '<path d="M9.5 2.8l3.7 3.7-5.6 5.6H3.9V8.4z"/><path d="M2.5 13.8h11"/>',
  heading: '<path d="M3.5 3v10M10.5 3v10M3.5 8h7"/><path d="M12.5 13v-3.5l1-.5"/>',
  grip: '<circle cx="6" cy="4" r=".7"/><circle cx="10" cy="4" r=".7"/><circle cx="6" cy="8" r=".7"/><circle cx="10" cy="8" r=".7"/><circle cx="6" cy="12" r=".7"/><circle cx="10" cy="12" r=".7"/>',
  more: '<circle cx="3.5" cy="8" r=".8"/><circle cx="8" cy="8" r=".8"/><circle cx="12.5" cy="8" r=".8"/>',
  outdent: '<path d="M7 4.5L3.5 8 7 11.5"/><path d="M3.5 8h10"/><path d="M13.5 3v10"/>',
  filter: '<path d="M2.5 3.5h11l-4.3 5.2v4l-2.4 1.3V8.7z"/>',
  check: '<path d="M3 8.5l3 3 7-7"/>',
  back: '<path d="M10 3.5L5.5 8l4.5 4.5"/>',
  folder: '<path d="M2.5 4.5h4l1.2 1.5h5.8v6.5h-11z"/>',
  palette: '<path d="M8 2.5a5.5 5.5 0 1 0 0 11c1 0 1.3-.7.9-1.5-.5-1 .1-1.8 1.1-1.8h1.4c1.3 0 2.1-.9 2.1-2.2 0-3-2.5-5.5-5.5-5.5z"/><circle cx="5.2" cy="7" r=".7"/><circle cx="7.5" cy="5" r=".7"/><circle cx="10.4" cy="5.6" r=".7"/>',
  type: '<path d="M3 4.5V3h10v1.5M8 3v10M6.2 13h3.6"/>',
};

/** An icon as SVG markup, stroked in currentColor. */
function icon(name, label) {
  const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" ${a11y}>${ICONS[name]}</svg>`;
}

/** Fill every [data-icon] with its icon. */
function drawIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) {
    el.innerHTML = icon(el.dataset.icon) + (el.dataset.iconText ?? '');
  }
}

// One list of faces drives every face setting: the text face and the machine
// voice both choose from it. A face added later is one more entry here (in the
// app: one entry in core/config, its fonts and its tuning in tokens.css).
const FACES = [
  { id: 'plex-mono', name: 'IBM Plex Mono', family: "'IBM Plex Mono', ui-monospace, monospace", mono: true },
  { id: 'newsreader', name: 'Newsreader', family: "'Newsreader', Georgia, serif" },
  { id: 'literata', name: 'Literata', family: "'Literata', Georgia, serif" },
  { id: 'plex-sans', name: 'IBM Plex Sans', family: "'IBM Plex Sans', Arial, sans-serif" },
  { id: 'source-sans', name: 'Source Sans 3', family: "'Source Sans 3', Arial, sans-serif" },
  { id: 'atkinson', name: 'Atkinson Hyperlegible Next', family: "'Atkinson Hyperlegible Next', Arial, sans-serif" },
  { id: 'schibsted', name: 'Schibsted Grotesk', family: "'Schibsted Grotesk', Arial, sans-serif" },
  { id: 'hanken', name: 'Hanken Grotesk', family: "'Hanken Grotesk', Arial, sans-serif" },
  { id: 'instrument', name: 'Instrument Sans', family: "'Instrument Sans', Arial, sans-serif" },
];
/** The faces the text voice offers (all but the mono), and the machine voice (all). */
const TEXT_FACES = FACES.filter((face) => !face.mono);
const MACHINE_FACES = FACES;

function setMachineFace(id) {
  const face = FACES.find((each) => each.id === id) ?? FACES[0];
  document.documentElement.style.setProperty('--eien-face-mono', face.family);
}
function setTextFace(id) {
  if (id === 'newsreader') delete document.documentElement.dataset.face;
  else document.documentElement.dataset.face = id;
}

/** The explorations' bar: [data-x-set="attr"] groups set data-<attr> on <html>. */
function wireBar(onChange = () => {}) {
  for (const group of document.querySelectorAll('[data-x-set]')) {
    const attr = group.dataset.xSet;
    const buttons = [...group.querySelectorAll('button[data-value]')];
    const pick = (value) => {
      document.documentElement.dataset[attr] = value;
      for (const b of buttons) b.setAttribute('aria-pressed', String(b.dataset.value === value));
      onChange(attr, value);
    };
    for (const b of buttons) b.addEventListener('click', () => pick(b.dataset.value));
    pick(document.documentElement.dataset[attr] ?? buttons[0].dataset.value);
  }
}
