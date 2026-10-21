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
  bold: '<path d="M4.5 2.8h4.2a2.6 2.6 0 0 1 0 5.2H4.5z"/><path d="M4.5 8h4.9a2.6 2.6 0 0 1 0 5.2H4.5z"/><path d="M4.5 2.8v10.4"/>',
  italic: '<path d="M7.2 2.8h5M3.8 13.2h5M10 2.8L6 13.2"/>',
  underline: '<path d="M4.5 2.8v4.6a3.5 3.5 0 0 0 7 0V2.8"/><path d="M3.5 13.5h9"/>',
  strike: '<path d="M2.5 8h11"/><path d="M11.2 4.4c-.6-1-1.8-1.6-3.2-1.6-1.8 0-3.2 1-3.2 2.4 0 .9.5 1.6 1.6 2.1"/><path d="M5 11.4c.6 1.1 1.8 1.8 3.3 1.8 1.9 0 3.3-1 3.3-2.5 0-.6-.2-1.1-.6-1.5"/>',
  focus: '<path d="M2.5 4h11" opacity=".35"/><path d="M2.5 8h11"/><path d="M2.5 12h8" opacity=".35"/><path d="M1 6v4M15 6v4"/>',
  rename: '<path d="M3 11.5h6.5"/><path d="M11.5 3v10M10 3h3M10 13h3"/>',
  trash: '<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9"/>',
  move: '<path d="M2.5 4.5h4l1.2 1.5h5.8v6.5h-11z"/><path d="M6.5 9.5h4M9 8l1.5 1.5L9 11"/>',
  include: '<path d="M8 4v8M4 8h8"/>',
  exclude: '<path d="M4 8h8"/>',
  resize: '<path d="M13 7l-6 6M13 10.5L10.5 13"/>',
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

// Themes: [day, night] for each colour token. The rules are the ink at low
// strength, so they follow it. Washi is tokens.css's own; the rest are new.
const THEME_TOKENS = ['desk', 'blotter', 'band', 'paper', 'selected', 'ink', 'ink-soft', 'pencil', 'faded', 'seal'];
const THEMES = {
  washi: { name: 'Washi', kanji: '和紙', note: 'Eien’s own: paper and sumi ink', t: {
    desk: ['#d9d2c8', '#110e0b'], blotter: ['#eae5dd', '#1a1713'], band: ['#f4f1ea', '#201d19'], paper: ['#fdfbf7', '#28241f'], selected: ['#ede9e3', '#38332e'],
    ink: ['#23201c', '#e9e2d4'], 'ink-soft': ['#51473c', '#c3b9a7'], pencil: ['#5d5348', '#a7a095'], faded: ['#766d62', '#837c73'], seal: ['#c4472d', '#e0603f'] } },
  kinari: { name: 'Kinari', kanji: '生成り', note: 'Unbleached cloth: yellower paper, a persimmon seal', t: {
    desk: ['#d8cfb8', '#14110a'], blotter: ['#e9e2cd', '#1c180f'], band: ['#f3eedd', '#231e14'], paper: ['#fcf9ee', '#2b251a'], selected: ['#ece5d1', '#3b3426'],
    ink: ['#2a2418', '#ece3cc'], 'ink-soft': ['#574a33', '#c8bb9c'], pencil: ['#5f523d', '#ab9f86'], faded: ['#7b6d56', '#88806d'], seal: ['#b8432a', '#dc6a43'] } },
  aizome: { name: 'Aizome', kanji: '藍染', note: 'Indigo dye: cool paper, blue-black ink', t: {
    desk: ['#c9cfd8', '#0b0e14'], blotter: ['#dfe3e9', '#121620'], band: ['#edf0f4', '#181d28'], paper: ['#fbfcfd', '#1f2533'], selected: ['#e3e8ef', '#2e3648'],
    ink: ['#17213a', '#dde4f0'], 'ink-soft': ['#34405c', '#b3bfd6'], pencil: ['#3f4b64', '#97a3ba'], faded: ['#5f6a80', '#7a8599'], seal: ['#c4472d', '#e3664a'] } },
  koke: { name: 'Koke', kanji: '苔', note: 'A moss garden: green-grey desk, quiet ink', t: {
    desk: ['#cdd2c4', '#0d100b'], blotter: ['#e1e5d9', '#141811'], band: ['#eef0e8', '#1a1f16'], paper: ['#fafbf6', '#21271c'], selected: ['#e5e9dc', '#30382a'],
    ink: ['#1f2619', '#e2e8d6'], 'ink-soft': ['#3e4833', '#bcc6ab'], pencil: ['#48523c', '#a0aa90'], faded: ['#67705a', '#808a72'], seal: ['#a8432f', '#d76a4e'] } },
  rosoku: { name: 'Rōsoku', kanji: '蝋燭', note: 'Candlelight: amber at night, no blue light', t: {
    desk: ['#dccab2', '#120c06'], blotter: ['#ecdfcb', '#1b130b'], band: ['#f5ece0', '#22180e'], paper: ['#fdf8f0', '#2a1f13'], selected: ['#efe3d1', '#3c2d1e'],
    ink: ['#2b1d10', '#f0dcc0'], 'ink-soft': ['#5a4129', '#d2b894'], pencil: ['#634d37', '#b39b7c'], faded: ['#7f6a53', '#8f7c64'], seal: ['#b9442b', '#e8763f'] } },
  sumi: { name: 'Sumi', kanji: '墨', note: 'For tired eyes: the most contrast there is', t: {
    desk: ['#cfcfcc', '#000000'], blotter: ['#e6e6e3', '#0a0a0a'], band: ['#f2f2ef', '#141414'], paper: ['#ffffff', '#1b1b1b'], selected: ['#e8e8e4', '#2c2c2c'],
    ink: ['#000000', '#f5f5f2'], 'ink-soft': ['#262626', '#d9d9d4'], pencil: ['#3a3a3a', '#bdbdb8'], faded: ['#5e5e5e', '#8f8f8a'], seal: ['#c4361d', '#ff6a45'] } },
  sakura: { name: 'Sakura-nezumi', kanji: '桜鼠', note: 'Cherry-grey: plum ink, a rose seal', t: {
    desk: ['#d8cdcc', '#120d0e'], blotter: ['#e9e1e0', '#1b1415'], band: ['#f3eeed', '#221a1b'], paper: ['#fdfafa', '#2a2122'], selected: ['#eee6e5', '#3a2f30'],
    ink: ['#2a1e20', '#efe1e2'], 'ink-soft': ['#573f43', '#cbb5b8'], pencil: ['#5f464a', '#ad989b'], faded: ['#7c6468', '#8d7b7d'], seal: ['#b2394a', '#e0697a'] } },
};
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function luminance(h) {
  return hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; })
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
const contrast = (a, b) => { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hsl = (h, s, l) => { s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return '#' + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); };
/**
 * An ink of hue `h` and saturation `sat`, starting at lightness `l` and stepped
 * darker by day (`dir` -1) or lighter by night (+1) until it reaches `min`
 * contrast on every one of `grounds`: the hue stays, the contrast holds.
 */
function fitInk(h, sat, l, grounds, min, dir) {
  let ink = hsl(h, sat, l);
  while (grounds.some((g) => contrast(ink, g) < min + 0.1) && l > 0 && l < 100) { l += dir; ink = hsl(h, sat, l); }
  return ink;
}
/** "Custom": four choices, and every token worked out from them, day and night. */
function mixTheme({ paper: ph, warmth: w, ink: ih, seal: sh }, name = 'My Room') {
  const surf = (dl, nl) => [hsl(ph, w, dl), hsl(ph, Math.min(w, 22), nl)];
  const t = { desk: surf(83, 5), blotter: surf(89, 8), band: surf(94, 11), paper: surf(98.5, 14), selected: surf(91, 19), seal: [hsl(sh, 63, 47), hsl(sh, 72, 56)] };
  const grounds = (s) => ['desk', 'band', 'paper', 'selected'].map((k) => t[k][s]);
  // The inks carry their hue, saturated enough to see by day, each as light as Eien's contrast allows.
  const ink = (sat, dl, nsat, nl, min) => [fitInk(ih, sat, dl, grounds(0), min, -1), fitInk(ih, nsat, nl, grounds(1), min, 1)];
  Object.assign(t, { ink: ink(48, 16, 38, 88, 7), 'ink-soft': ink(38, 30, 30, 70, 4.5), pencil: ink(30, 34, 20, 62, 4.5), faded: ink(20, 46, 12, 52, 3) });
  return { name, kanji: '', note: 'Your own', t };
}
/** A theme on the whole page: each token as light-dark(day, night); the rules from the ink. */
function applyTheme(theme, el = document.documentElement) {
  for (const k of THEME_TOKENS) el.style.setProperty(`--eien-${k}`, `light-dark(${theme.t[k][0]}, ${theme.t[k][1]})`);
  const [d, n] = theme.t.ink.map((c) => hexRgb(c).join(' '));
  el.style.setProperty('--eien-rule-soft', `light-dark(rgb(${d} / 0.07), rgb(${n} / 0.07))`);
  el.style.setProperty('--eien-rule', `light-dark(rgb(${d} / 0.13), rgb(${n} / 0.14))`);
  el.style.setProperty('--eien-rule-strong', `light-dark(rgb(${d} / 0.26), rgb(${n} / 0.26))`);
  el.style.setProperty('--eien-paper-raised', `light-dark(color-mix(in srgb, ${theme.t.paper[0]} 45%, #fff), color-mix(in srgb, ${theme.t.paper[1]} 88%, #fff))`);
  el.style.setProperty('--eien-well', `light-dark(color-mix(in srgb, ${theme.t.paper[0]} 70%, ${theme.t.band[0]}), color-mix(in srgb, ${theme.t.paper[1]} 60%, ${theme.t.blotter[1]}))`);
}
