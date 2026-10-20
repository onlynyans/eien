// Eien — design specimen. Builds the colour plates from the token list below,
// then reads every hex, size and contrast ratio back from the live CSS, so the
// page can never disagree with tokens.css.

const root = document.documentElement;

/* ── Theme: System / Day / Night ───────────────────────────────────────── */

const THEME_KEY = 'eien-specimen-theme';

function applyTheme(choice) {
  if (choice === 'light' || choice === 'dark') root.setAttribute('data-theme', choice);
  else root.removeAttribute('data-theme');
  const current = choice === 'light' || choice === 'dark' ? choice : 'system';
  for (const button of document.querySelectorAll('[data-theme-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === current));
  }
}

function savedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

applyTheme(savedTheme());

document.querySelector('.theme').addEventListener('click', (event) => {
  const button = event.target.closest('[data-theme-choice]');
  if (!button) return;
  const choice = button.dataset.themeChoice;
  applyTheme(choice);
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Private windows may refuse storage; the choice still holds for this visit.
  }
});

/* ── Text face: Newsreader / Literata / Plex Sans / Archivo ────────────── */
// The writer's choice (tokens.css, data-face). Kept across visits and mockups.

const FACE_KEY = 'eien-mockup-face';
const FACES = {
  newsreader: 'Newsreader',
  literata: 'Literata',
  'plex-sans': 'IBM Plex Sans',
  archivo: 'Archivo',
};

function applyFace(face) {
  root.setAttribute('data-face', face);
  for (const button of document.querySelectorAll('[data-face-choice]')) {
    button.setAttribute('aria-pressed', String(button.dataset.faceChoice === face));
  }
  for (const el of document.querySelectorAll('[data-face-name]')) el.textContent = FACES[face];
}

function savedFace() {
  try {
    const face = localStorage.getItem(FACE_KEY);
    return Object.hasOwn(FACES, face) ? face : 'newsreader';
  } catch {
    return 'newsreader';
  }
}

applyFace(savedFace());

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-face-choice]');
  if (!button) return;
  const face = button.dataset.faceChoice;
  applyFace(face);
  readValues();
  try {
    localStorage.setItem(FACE_KEY, face);
  } catch {
    // Private windows may refuse storage; the choice still holds for this visit.
  }
});

/* ── The colours, in the order tokens.css gives them ───────────────────── */
// show: how one cell draws the colour. A cell is either on the desk or on paper.

const FAMILIES = {
  surface: [
    {
      token: '--eien-desk',
      name: 'Desk',
      use: 'The window itself: sidebar, note list and the margin round the page.',
      show: 'ground',
    },
    {
      token: '--eien-paper',
      name: 'Washi paper',
      use: 'The sheet you write on, and the brightest thing on screen.',
      show: 'sheet',
    },
    {
      token: '--eien-paper-raised',
      name: 'Top sheet',
      use: 'A menu or popover: one sheet above the page.',
      show: 'sheet',
    },
    {
      token: '--eien-well',
      name: 'Well',
      use: 'Inside a field: pressed into the desk.',
      show: 'sheet',
    },
    {
      token: '--eien-hover',
      name: 'Breath',
      use: 'A row under the pointer: the faintest wash of ink.',
      show: 'wash',
    },
    {
      token: '--eien-press',
      name: 'Pressed',
      use: 'A row or button while it is being pressed.',
      show: 'wash',
    },
    {
      token: '--eien-scrim',
      name: 'Scrim',
      use: 'The desk dimmed behind a sheet laid over it.',
      show: 'scrim',
    },
  ],
  ink: [
    {
      token: '--eien-ink',
      name: 'Sumi ink',
      use: 'The writing itself, and titles.',
      show: 'text',
      voice: 'prose',
      sample: 'She takes it.',
    },
    {
      token: '--eien-ink-soft',
      name: 'Iron-gall',
      use: 'Names in the tree and list, previews, secondary text.',
      show: 'text',
      voice: 'row',
      sample: 'Needle and Thread',
    },
    {
      token: '--eien-pencil',
      name: 'Graphite',
      use: 'Counts, dates and labels.',
      show: 'text',
      voice: 'meta',
      sample: '1,204 words',
    },
    {
      token: '--eien-faded',
      name: 'Faded',
      use: 'Placeholders and disabled controls only: nothing you must read.',
      show: 'text',
      voice: 'meta',
      sample: 'Search 312 notes',
    },
  ],
  rules: [
    {
      token: '--eien-rule-soft',
      name: 'Soft hairline',
      use: 'Inside a pane: between rows, under a heading.',
      show: 'rule',
    },
    {
      token: '--eien-rule',
      name: 'Hairline',
      use: 'Between panes, and the paper’s edge.',
      show: 'rule',
    },
    {
      token: '--eien-rule-strong',
      name: 'Strong hairline',
      use: 'A field’s edge; the edge of a chosen or pressed button.',
      show: 'rule',
    },
    {
      token: '--eien-mark-w',
      tokens: ['--eien-hairline', '--eien-mark-w'],
      name: 'Hairline and mark',
      use: 'A rule is one hairline wide. A mark is two: the seal’s rule beside the selected row, the caret, the focus ring.',
      show: 'widths',
    },
  ],
  seal: [
    {
      token: '--eien-seal',
      name: 'Vermilion seal',
      use: 'The mark, each sealed version, the status line’s square, the selected row’s rule, the caret.',
      show: 'mark',
    },
    {
      token: '--eien-seal-wash',
      name: 'Seal wash',
      use: 'The ground of the selected row beside its rule, and of text you select.',
      show: 'selected',
    },
    {
      token: '--eien-on-seal',
      name: 'Pressed glyph',
      use: '永 pressed into the seal: the paper showing through.',
      show: 'glyph',
    },
  ],
  status: [
    {
      token: '--eien-added',
      name: 'Moss',
      use: 'Words added since the seal.',
      show: 'text',
      voice: 'row',
      sample: 'as he mends',
    },
    {
      token: '--eien-added-wash',
      name: 'Moss wash',
      use: 'Behind an added word, under its underline.',
      show: 'ins',
    },
    {
      token: '--eien-removed',
      name: 'Carmine pencil',
      use: 'Words removed since the seal, and Delete.',
      show: 'text',
      voice: 'row',
      sample: 'him work.',
    },
    {
      token: '--eien-removed-wash',
      name: 'Carmine wash',
      use: 'Behind a removed word, under its strike.',
      show: 'del',
    },
    {
      token: '--eien-caution',
      name: 'Ochre',
      use: 'A sync conflict to look at.',
      show: 'text',
      voice: 'label',
      sample: 'Conflict',
    },
    {
      token: '--eien-caution-wash',
      name: 'Ochre wash',
      use: 'Behind the conflict notice.',
      show: 'notice',
    },
  ],
};

const SCHEMES = [
  { scheme: 'light', word: 'Day' },
  { scheme: 'dark', word: 'Night' },
];

// What one cell shows. data-measure marks the thing whose contrast is read.
function cellContent(c) {
  switch (c.show) {
    case 'text':
      return `<span class="sample sample--${c.voice}${c.link ? ' sample--link' : ''}" style="color: var(${c.token})" data-measure="text">${c.sample}</span>`;
    case 'mark':
      return '<span class="sample sample--marks"><span class="seal" data-measure="mark">永</span><span class="seal seal--small"></span></span>';
    case 'glyph':
      return '<span class="seal seal--plate" data-measure="text">永</span>';
    case 'selected':
      return '<span class="tree-row tree-row--static" aria-current="true"><span class="count">iii</span><span data-measure="text">Seventeen</span></span>';
    case 'ins':
      return '<span class="sample sample--row"><ins data-measure="text">as he mends</ins></span>';
    case 'del':
      return '<span class="sample sample--row"><del data-measure="text">him work.</del></span>';
    case 'notice':
      return '<span class="sample notice-chip"><span class="label" data-measure="text">Conflict</span></span>';
    case 'widths':
      return '<span class="widths"><span class="tree-row tree-row--static" aria-current="true"><span class="count">iii</span>Seventeen</span><span class="focus-demo" data-measure="outline">Compare</span></span>';
    case 'rule':
      return `<span class="rule-line" style="border-top-color: var(${c.token})"></span><span class="rule-line rule-line--down" style="border-left-color: var(${c.token})"></span>`;
    default:
      return '';
  }
}

function cell(c, ground) {
  if (c.show === 'rule')
    return `<div class="cell cell--${ground} cell--rule">${cellContent(c)}</div>`;
  return `<div class="cell cell--${ground}">${cellContent(c)}<span class="ratio"></span></div>`;
}

function valueLines(tokens) {
  return tokens
    .map((t) => `<span class="hex-line"><span class="count">${t} <span data-value-of="${t}"></span></span></span>`)
    .join('');
}

function hexLines(token) {
  return SCHEMES.map(
    ({ scheme, word }) =>
      `<span class="hex-line"><span class="chip" data-scheme="${scheme}"><span style="background: var(${token})"></span></span><span class="count">${word} <span data-hex="${token}" data-in="${scheme}"></span></span></span>`,
  ).join('');
}

function info(c) {
  return `<div class="sw-info">
      <h4 class="sw-name">${c.name}</h4>
      <p class="sw-use">${c.use}</p>
      ${c.tokens ? '' : `<code class="token">${c.token}</code>`}
    </div>`;
}

// A row: name on the left; day and night halves, each with a desk and a paper cell.
function swatchRow(c) {
  const halves = SCHEMES.map(
    ({ scheme, word }) =>
      `<div class="half" data-scheme="${scheme}"><span class="half-word">${word}</span>${cell(c, 'desk')}${cell(c, 'paper')}</div>`,
  ).join('');
  return `<article class="swatch-row">
    ${info(c)}
    <p class="sw-hex">${c.tokens ? valueLines(c.tokens) : hexLines(c.token)}</p>
    <div class="sw-show">${halves}</div>
  </article>`;
}

// A card, for surfaces: the colour laid on the desk, day beside night.
function swatchCard(c) {
  const halves = SCHEMES.map(
    ({ scheme, word }) =>
      `<div class="half half--plate" data-scheme="${scheme}">
        <span class="half-word">${word}</span>
        <span class="plate plate--${c.show}" style="background: var(${c.token})">${c.show === 'scrim' ? '<span class="plate-sheet"></span>' : ''}</span>
        <span class="half-hex" data-hex="${c.token}" data-in="${scheme}"></span>
      </div>`,
  ).join('');
  return `<article class="swatch-card"><div class="sw-show">${halves}</div>${info(c)}</article>`;
}

for (const [family, colours] of Object.entries(FAMILIES)) {
  const box = document.querySelector(`[data-family="${family}"]`);
  const draw = family === 'surface' ? swatchCard : swatchRow;
  box.innerHTML = colours.map(draw).join('');
}

/* ── Space ─────────────────────────────────────────────────────────────── */

const SPACES = [
  ['--eien-space-1', 'a gap between a mark and its word'],
  ['--eien-space-2', 'inside a control'],
  ['--eien-space-3', 'a row’s padding'],
  ['--eien-space-4', 'a pane’s gutter'],
  ['--eien-space-5', 'between groups'],
  ['--eien-space-6', 'between sections'],
  ['--eien-space-7', 'the page’s top margin'],
  ['--eien-space-8', 'the sheet’s side margins'],
];

document.querySelector('[data-space-scale]').innerHTML = SPACES.map(
  ([token, use]) => `<div class="space-row">
    <code class="token">${token}</code>
    <span class="count space-px" data-value-of="${token}"></span>
    <span class="space-bar-track"><span class="space-bar" style="width: var(${token})"></span></span>
    <span class="space-use">${use}</span>
  </div>`,
).join('');

/* ── Layout: the panes and the smallest things, drawn at their size ────── */

const LAYOUT = [
  ['--eien-sidebar-w', 'the sidebar'],
  ['--eien-list-w', 'the note list'],
  ['--eien-panel-w', 'a side panel on the page: versions'],
  ['--eien-touch', 'the smallest thing a finger presses'],
  ['--eien-row-h', 'a row in the tree or list, on the desktop (its height)'],
  ['--eien-seal-size', 'the app’s mark'],
];

document.querySelector('[data-layout-scale]').innerHTML = LAYOUT.map(
  ([token, use]) => `<div class="space-row layout-row">
    <code class="token">${token}</code>
    <span class="count space-px" data-value-of="${token}"></span>
    <span class="layout-bar-track"><span class="space-bar" style="width: var(${token})"></span></span>
    <span class="space-use">${use}</span>
  </div>`,
).join('');

/* ── Reading the tokens back ───────────────────────────────────────────── */

// Token values as written (sizes, the measure, the leading), read where each
// one is shown: inside a figure with its own data-face, that face's value.
function readValues() {
  for (const el of document.querySelectorAll('[data-value-of]')) {
    el.textContent = getComputedStyle(el).getPropertyValue(el.dataset.valueOf).trim();
  }
}
readValues();

function parseColour(text) {
  const [r, g, b, a = 1] = text.match(/[\d.]+/g).map(Number);
  return { r, g, b, a };
}

// A colour as each scheme resolves it: a probe inside a forced scheme.
const probes = {};
for (const { scheme } of SCHEMES) {
  const probe = document.createElement('span');
  probe.className = 'probe';
  probe.dataset.scheme = scheme;
  document.body.append(probe);
  probes[scheme] = probe;
}

function resolve(token, scheme) {
  const probe = probes[scheme];
  probe.style.backgroundColor = `var(${token})`;
  return parseColour(getComputedStyle(probe).backgroundColor);
}

const hex2 = (n) => Math.round(n).toString(16).padStart(2, '0');

// The browser keeps alpha in 8 bits (0.045 reads back as 0.043), so round the
// percentage to the half the tokens are written in.
function formatHex({ r, g, b, a }) {
  const hex = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return a < 1 ? `${hex} at\u00a0${Math.round(a * 200) / 2}%` : hex;
}

for (const el of document.querySelectorAll('[data-hex]')) {
  el.textContent = formatHex(resolve(el.dataset.hex, el.dataset.in));
}

/* ── Contrast, measured ────────────────────────────────────────────────── */

// Lay one colour over another (for washes and hovers over the desk or paper).
function over(top, under) {
  const a = top.a + under.a * (1 - top.a);
  const mix = (k) => (top[k] * top.a + under[k] * under.a * (1 - top.a)) / a;
  return { r: mix('r'), g: mix('g'), b: mix('b'), a };
}

// The colour actually behind an element: its own and its ancestors' grounds.
function groundBehind(el) {
  const layers = [];
  for (let node = el; node; node = node.parentElement) {
    const c = parseColour(getComputedStyle(node).backgroundColor);
    if (c.a > 0) layers.push(c);
    if (c.a >= 1) break;
  }
  return layers.reverse().reduce((under, top) => over(top, under));
}

function luminance({ r, g, b }) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function verdict(ratio, kind) {
  if (kind !== 'text') return ratio >= 3 ? 'mark: AA' : 'too faint';
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'large type only';
  return 'too faint';
}

function measureAll() {
  for (const target of document.querySelectorAll('[data-measure]')) {
    const out = target.closest('.cell')?.querySelector('.ratio');
    if (!out) continue;
    const kind = target.dataset.measure;
    const style = getComputedStyle(target);
    // A mark is measured by its own colour, a focus ring by its outline, each
    // against what it sits on.
    const own = { mark: style.backgroundColor, outline: style.outlineColor }[kind];
    const fg = parseColour(own ?? style.color);
    const bg = groundBehind(own ? target.parentElement : target);
    const ratio = contrast(fg, bg);
    const what = kind === 'outline' ? 'focus ring ' : '';
    out.textContent = `${what}${ratio.toFixed(1)} : 1 · ${verdict(ratio, kind)}`;
  }
}

measureAll();

/* ── Compare: one button cycles changes → the seal alone → the draft ───── */

const passage = document.getElementById('passage');
const cycle = document.getElementById('compare-cycle');
const status = document.getElementById('compare-status');

const words = (nodes) =>
  [...nodes].reduce((n, el) => n + el.textContent.trim().split(/\s+/).length, 0);
const added = words(passage.querySelectorAll('ins'));
const removed = words(passage.querySelectorAll('del'));

const VIEWS = {
  changes: {
    button: 'Compare: changes',
    status: `${added} words added · ${removed} removed · since sealed 2h ago`,
    next: 'sealed',
  },
  sealed: { button: 'Compare: sealed', status: 'Read-only · as sealed 2h ago', next: 'draft' },
  draft: { button: 'Compare', status: 'The draft · 1,204 words', next: 'changes' },
};

function showView(view) {
  passage.dataset.view = view;
  cycle.textContent = VIEWS[view].button;
  cycle.setAttribute('aria-pressed', String(view !== 'draft'));
  status.textContent = VIEWS[view].status;
}

showView('changes');
cycle.addEventListener('click', () => showView(VIEWS[passage.dataset.view].next));
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    showView(VIEWS[passage.dataset.view].next);
  }
});

/* ── Versions: a click opens that version (the state rows stay as drawn) ─ */

const versions = document.querySelector('.version-list');
versions.addEventListener('click', (event) => {
  const row = event.target.closest('.version-row');
  if (!row) return;
  for (const other of versions.querySelectorAll('[aria-current]'))
    other.removeAttribute('aria-current');
  row.setAttribute('aria-current', 'true');
});
