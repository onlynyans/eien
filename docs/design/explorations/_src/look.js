// Shared by the quick look's explorations (look-*.html, backlog #49): one
// control, in reach in every layout and on the phone, opens a popover of the
// look's everyday settings. With a note it sets the notes' look; with an EPUB
// (#40) the shelf's own, kept apart. The window, the book and the phone are the
// EPUB family's (epub.js); a note beside the book is its Scroll 3. Each
// direction says where the control stands (Look.control, Look.colophon,
// Look.corner, Look.phone*), where the popover opens from (Look.place) and its
// shape; the settings, the two looks, the popover's controls and its keys are
// here, the same in all three.
/*@include:epub.js*/
Epub.paged = false;

Object.assign(ICONS, {
  // The look: a capital and a small letter, as a type specimen opens.
  look: '<path d="M1.8 13L5.2 3.5h.6L9.2 13M3 9.8h5"/><circle cx="12" cy="10.9" r="2"/><path d="M14 8.6V13"/>',
});

// The settings' schema as the quick look reads it (src/core/config/schema.ts),
// trimmed to what it needs. Only `quick` is new: a mark on the setting, not a
// second list. 'window' is one value for every page (Day or night); 'page' is
// a value for notes and, kept apart, one for books, from the same entry. The
// popover lists the marked settings in the schema's order, where Settings
// offers them (offeredOn). Line spacing and Page width are new settings (NEW).
const SCHEMA = [
  { key: 'appearance.scheme', label: 'Day or night', type: 'choice', choices: { system: 'System', day: 'Day', night: 'Night' }, default: 'system', quick: 'window' },
  { key: 'appearance.layout', label: 'Layout', type: 'choice', choices: { band: 'Band', slip: 'Slip', runhead: 'Running head' }, default: 'band' },
  { key: 'appearance.face', label: 'Typeface', type: 'choice', faces: true, default: 'newsreader', quick: 'page' },
  { key: 'appearance.interfaceFace', label: 'Interface font', type: 'choice', faces: true, default: 'plex-mono' },
  { key: 'appearance.textSize', label: 'Text size', type: 'number', min: 90, max: 130, step: 10, default: 100, quick: 'page' },
  { key: 'appearance.leading', label: 'Line spacing', type: 'choice', choices: { tight: 'Tight', set: 'As set', loose: 'Loose' }, default: 'set', quick: 'page', isNew: true },
  { key: 'appearance.density', label: 'Density', type: 'choice', choices: { comfortable: 'Comfortable', compact: 'Compact' }, default: 'comfortable' },
  { key: 'page.width', label: 'Page width', type: 'choice', choices: { narrow: 'Narrow', set: 'As set', wide: 'Wide' }, default: 'set', quick: 'page', isNew: true },
  { key: 'appearance.frame', label: 'Page', type: 'choice', choices: { sheet: 'Sheet', full: 'Full' }, default: 'sheet', quick: 'page' },
];
const QUICK = SCHEMA.filter((s) => s.quick);
// What a choice does to the words: the face's own leading and measure, a step either way.
const LEAD = { tight: 0.9, set: 1, loose: 1.12 };
const WIDTH = { narrow: 0.84, set: 1, wide: 1.18 };

// The values: the window's, the notes', and the shelf's (here the shelf starts in
// Literata, set looser, so the two looks are told apart at a glance).
const defaults = (s) => s.default;
const V = {
  window: Object.fromEntries(QUICK.filter((s) => s.quick === 'window').map((s) => [s.key, defaults(s)])),
  note: Object.fromEntries(QUICK.filter((s) => s.quick === 'page').map((s) => [s.key, defaults(s)])),
  epub: Object.fromEntries(QUICK.filter((s) => s.quick === 'page').map((s) => [s.key, defaults(s)])),
};
Object.assign(V.epub, { 'appearance.face': 'literata', 'appearance.leading': 'loose' });
const store = (s, kind) => (s.quick === 'window' ? V.window : V[kind]);
const valueOf = (s, kind) => store(s, kind)[s.key];
const faceName = (id) => TEXT_FACES.find((f) => f.id === id)?.name ?? id;
/** A look in a few words, for a readout or a tooltip: its face and its size. */
const lookWords = (kind) => `${faceName(V[kind]['appearance.face'])} · ${V[kind]['appearance.textSize']}%`;
// Whose look, as the writer reads it: the notes', or the shelf's (#40's SHELF). Never
// "books": in Eien a book is a writer's own manuscript, its chapters notes.
const WHOSE = { note: 'Notes', epub: 'Shelf' };

/** A page's look as attributes: its face's tokens, its size, leading and measure, its frame. */
function lookOf(kind) {
  const v = V[kind];
  return {
    attrs: `data-look="${kind}" data-face="${v['appearance.face']}" style="--look-scale:${v['appearance.textSize'] / 100}; --look-lead:${LEAD[v['appearance.leading']]}; --look-width:${WIDTH[v['page.width']]}"`,
    frame: v['appearance.frame'],
  };
}

// The note you're writing, in Research, beside the book it answers.
const NOTE = {
  title: 'At the Assembly', crumb: 'Fic / Research / At the Assembly', words: 1214, sealed: 'yesterday', tags: ['fic/pp', 'draft'],
  paras: [
    'She hears it from two chairs away, and the worst of it is how bored he sounds.',
    'Write the scene from Charlotte’s side: she sees Lizzy hear it, and sees her decide to laugh. The laugh comes a beat too late, and only Charlotte notices the beat.',
    'Afterwards, in the carriage, nobody mentions Mr Darcy at all, which is how Charlotte knows the evening will be talked about for a month.',
  ],
};
const NOTE_ROWS = [
  { title: 'At the Assembly', words: 1214, p: NOTE.paras[0] },
  { title: 'Netherfield, from the stairs', words: 862, p: 'The house is louder than the Lucases’, and colder.' },
  { title: 'Charlotte’s letter', words: 405, p: 'My dear Eliza, you will laugh, but I have been thinking.' },
  { title: 'Who says what, and when', words: 230, p: 'Mrs Bennet: everything, at once. Mr Bennet: one line, late.' },
];

// What's open: a note, a book, or both side by side; the one you're in.
const Q = { side: 'epub', phoneSide: 'epub', open: null, back: null };
const opened = () => (['note', 'epub', 'both'].includes(root.dataset.open) ? root.dataset.open : 'both');
/** The page the keys and the shared tools act on: a note or a book. */
const activeKind = () => (choices().device === 'phone' ? (opened() === 'both' ? Q.phoneSide : opened()) : opened() === 'both' ? Q.side : opened());

/** Hooks each direction fills: where the control stands, and where the popover opens from. */
const Look = {
  name: '', shape: 'column',
  control: () => '', colophon: () => '', corner: () => '',
  phoneTool: () => '', phoneFoot: () => '', phoneCorner: () => '',
  /** The popover's anchor for a kind of page, by its data-k. */
  anchor: () => '',
  /** Where the popover stands by its anchor: 'below' or 'above', its end or start lined up. */
  place: { y: 'below', x: 'end' },
};

// Drawing the page: a note, a book, or both (the split's Two sheets).
const noteViews = (ctx) => `<span class="tools" role="group" aria-label="Views">${ctx.tool('live', 'Live', KEY('Mod-E'), 'aria-pressed="true"')}${ctx.tool('source', 'Source')}${ctx.tool('reading', 'Reading')}</span>`;
const bookViews = (ctx) => `<span class="tools" role="group" aria-label="How the book reads">${ctx.tool('pages', 'Pages')}${ctx.tool('scroll', 'Scroll', '', 'aria-pressed="true"')}</span>`;
const toolsOf = (ctx, kind) => (kind === 'epub' ? ctx.contentsTool() : ctx.tool('compare', 'Compare') + ctx.tool('versions', 'Versions') + ctx.tool('focus', 'Focus mode'));
/** The page's tools, the direction's control at their end where it stands there. */
const toolRow = (ctx, kind) => `${toolsOf(ctx, kind)}${Look.control(ctx, kind)}`;
Epub.tools = (ctx) => toolRow(ctx, activeKind());

function topFor(ctx) {
  const kind = activeKind();
  const views = kind === 'epub' ? bookViews(ctx) : noteViews(ctx);
  if (ctx.layout === 'band') return `<div class="band"><span class="tools-row quiet">${views}</span><span class="tools-row quiet">${toolRow(ctx, kind)}</span></div>`;
  if (ctx.layout === 'slip') return `<div class="topline"><span class="slip quiet">${views}<span class="tools-rule" aria-hidden="true"></span>${toolRow(ctx, kind)}</span></div>`;
  return '';
}
Epub.strip = (ctx) => {
  const kind = activeKind();
  return `<div class="seg"><span class="crumb">${kind === 'epub' ? ctx.crumb() : NOTE.crumb}</span><span class="tools-row">${kind === 'epub' ? bookViews(ctx) : noteViews(ctx)}${toolRow(ctx, kind)}</span></div>`;
};

const noteHtml = () => NOTE.paras.map((t) => `<p>${esc(t)}</p>`).join('');
const sheetFor = (ctx, kind, flat) => {
  const look = lookOf(kind);
  const corner = Look.corner(ctx, kind);
  if (kind === 'epub') return `<article class="sheet ch-sheet${flat ? ' sheet--flat' : ''}" ${look.attrs}>${corner}${ctx.head()}<div class="book-text" data-c="${R.c}">${chapterHtml(R.c)}</div></article>`;
  const head = ctx.layout === 'band' ? `<div class="sheet__head"><span class="crumb">${NOTE.crumb}</span><span class="tagset">${NOTE.tags.map((t) => `<span>#${t}</span>`).join('')}</span></div>`
    : ctx.layout === 'slip' ? `<div class="sheet__head"><span class="crumb">${NOTE.crumb}</span></div>` : '';
  return `<article class="sheet${flat ? ' sheet--flat' : ''}" ${look.attrs}>${corner}${head}<h1>${NOTE.title}</h1>
    <div class="prose note-prose" contenteditable="true" spellcheck="true" data-note data-k="note" aria-label="${NOTE.title}">${noteHtml()}</div></article>`;
};
const blotterFor = (ctx, kind, flat) => {
  const scroll = kind === 'epub'
    ? `data-main-scroll="chapter" data-keep-scroll="bk${R.c}" data-k="book-page" tabindex="0" role="region" aria-roledescription="book" aria-label="${BOOK.title}"`
    : `data-keep-scroll="note" role="region" aria-label="${NOTE.title}"`;
  return `<div class="blotter${Q.open && Q.open.kind !== kind && opened() === 'both' ? ' is-back' : ''}" data-side="${kind}" data-frame="${lookOf(kind).frame}" ${scroll}>${sheetFor(ctx, kind, flat)}</div>`;
};
const colophonFor = (ctx, kind) => {
  const items = kind === 'epub' ? [CHAPTERS[R.c].ord, '<span data-col-ch></span>', '<span data-col-book></span>']
    : [`${NOTE.words.toLocaleString('en')} words`, `sealed ${NOTE.sealed}`, ...(ctx.layout === 'runhead' ? [NOTE.tags.map((t) => `<span class="pill">#${t}</span>`).join(' ')] : [])];
  return ctx.colophon(items).replace('</footer>', `${Look.colophon(ctx, kind)}</footer>`);
};
Epub.page = (ctx) => {
  const open = opened();
  const top = topFor(ctx);
  if (open !== 'both') return `<div class="page">${top}${blotterFor(ctx, open, false)}${colophonFor(ctx, open)}</div>`;
  const folded = ctx.pageW < 2 * 360;
  const pager = `<span class="pager" role="group" aria-label="The two pages">${[['note', NOTE.title], ['epub', BOOK.title]].map(([k, w]) => `<button class="word-button" data-show="${k}" data-k="show-${k}" aria-pressed="${Q.side === k}">${w}</button>`).join('')}</span>`;
  const body = folded ? `<div class="duo">${blotterFor(ctx, Q.side, false)}</div>`
    : `<div class="duo" data-columns style="grid-template-columns: minmax(0, 1fr) var(--eien-hairline) minmax(0, 1fr)">${blotterFor(ctx, 'note', Q.side !== 'note')}<div class="divider" role="separator" aria-orientation="vertical" aria-label="Between the note and the book"></div>${blotterFor(ctx, 'epub', Q.side !== 'epub')}</div>`;
  return `<div class="page">${folded ? top.replace(/(<div class="(?:band|topline)">)/, `$1${pager}`) : top}${body}${colophonFor(ctx, Q.side)}</div>`;
};

// The list: the EPUB's contents with an EPUB in front, the folder's notes with a note.
const epubList = listHtml;
listHtml = () => {
  if (activeKind() === 'epub') return epubList();
  const row = (n, i) => `<button class="row row--note${i === 0 ? ' is-chosen' : ''}" data-k="nrow-${i}"${i === 0 ? ' aria-current="true"' : ''}><span class="t">${esc(n.title)}</span><span class="count">${n.words.toLocaleString('en')}</span><span class="p">${esc(n.p)}</span></button>`;
  return `<section class="ls" aria-label="Notes in Research"><div class="ls__band"><span class="field">Search</span></div>
    <div class="ls__head"><div class="ls__title">Research</div><span class="label">4 notes · 2,711 words</span></div>
    <div class="ls__rows" role="list" data-keep-scroll="nlist">${NOTE_ROWS.map(row).join('')}</div></section>`;
};

// The phone: the page you're on, the other a tap away when both are open.
Epub.phone = () => {
  const kind = activeKind();
  const look = lookOf(kind);
  const inner = kind === 'epub' ? `<div class="book-text" data-c="${R.c}">${chapterHtml(R.c)}</div>`
    : `<h1>${NOTE.title}</h1><div class="prose note-prose" contenteditable="true" data-note data-k="pnote" aria-label="${NOTE.title}">${noteHtml()}</div>`;
  // The page scrolls under anything laid at its corner or its foot, which stay in reach.
  return `${Look.phoneCorner(kind)}<div class="phone__page is-scroll" ${look.attrs} data-frame="${look.frame}" data-keep-scroll="p${kind}${R.c}"${kind === 'epub' ? ' data-main-scroll="chapter" data-k="book-page" tabindex="0"' : ''}>${inner}</div>${Look.phoneFoot(kind)}`;
};
Epub.phoneTools = (ctx) => (activeKind() === 'epub' ? ctx.tool('contents', 'Contents', '', 'data-contents') : '') + Look.phoneTool(ctx, activeKind());
Epub.after = (ctx, n) => {
  const set = (sel, text) => { for (const el of canvas.querySelectorAll(sel)) el.textContent = text; };
  set('[data-col-ch]', `${n.chPct}% of the chapter`);
  set('[data-col-book]', `${n.pct}% of the book`);
};

// The popover: the marked settings as Settings draws them, names only.
const radio = (s, kind, val, chosen) => `role="radio" aria-checked="${chosen}" tabindex="${chosen ? 0 : -1}" data-ql-key="${s.key}" data-ql-v="${val}" data-k="ql-${s.key}-${val}"`;
const CONTROLS = {
  faces: (s, kind, v) => `<div class="faces" role="radiogroup" aria-labelledby="ql-${s.key}">${TEXT_FACES.map((f) => `<button class="face" ${radio(s, kind, f.id, f.id === v)}><span class="face__sample" style="font-family:${f.family}">Aa Gg</span><span class="face__name">${f.name}</span></button>`).join('')}</div>`,
  choice: (s, kind, v) => `<div class="choices" role="radiogroup" aria-labelledby="ql-${s.key}">${Object.entries(s.choices).map(([val, w]) => `<button class="word-button" ${radio(s, kind, val, val === v)}>${w}</button>`).join('')}</div>`,
  number: (s, kind, v) => `<div class="stepper" role="group" aria-labelledby="ql-${s.key}"><button class="icon-button" data-ql-key="${s.key}" data-ql-step="-${s.step}" data-k="ql-${s.key}-dec" aria-label="Smaller" data-tip="Smaller"${v <= s.min ? ' disabled' : ''}>${icon('down')}</button><output aria-live="polite">${v}%</output><button class="icon-button" data-ql-key="${s.key}" data-ql-step="${s.step}" data-k="ql-${s.key}-inc" aria-label="Larger" data-tip="Larger"${v >= s.max ? ' disabled' : ''}>${icon('up')}</button></div>`,
};
const controlOf = (s, kind) => CONTROLS[s.faces ? 'faces' : s.type](s, kind, valueOf(s, kind));
function settingRow(s, kind) {
  const aside = s.quick === 'window' ? '<span class="ql__aside">every page</span>' : s.isNew ? '<span class="ql__aside">new</span>' : '';
  return `<div class="setting ql__row" data-ql-row="${s.key}"><span class="setting__name ql__name" id="ql-${s.key}">${s.label}${aside}</span>${controlOf(s, kind)}</div>`;
}
/** The popover for a kind of page: its head names whose look it is. */
function popoverHtml(kind, phone) {
  const rows = QUICK.map((s) => settingRow(s, kind));
  // A strip wider than the page pane falls back to the column.
  const shape = phone ? 'sheet' : Look.shape === 'strip' && context().pageW < 2 * LIST_W + 64 ? 'column' : Look.shape;
  // The strip lays the typeface beside the rest; the column and the phone's sheet, one under another.
  const body = shape === 'strip'
    ? `<div class="ql__cols"><div class="ql__col">${QUICK.filter((s) => s.faces).map((s) => settingRow(s, kind)).join('')}</div><div class="ql__col">${QUICK.filter((s) => !s.faces).map((s) => settingRow(s, kind)).join('')}</div></div>`
    : rows.join('');
  return `<div class="ql ql--${shape}" data-ql data-ql-kind="${kind}" role="dialog" aria-label="Look: ${WHOSE[kind]}">
    <div class="ql__head"><span class="crumb">Look <span class="ql__slash">/</span> <span class="ql__whose">${WHOSE[kind]}</span></span><span class="ql__what">${kind === 'epub' ? 'every book on the shelf' : 'every note'}</span></div>
    <div class="ql__body">${body}</div>
    <div class="ql__foot"><button class="word-button" data-ql-settings data-k="ql-settings">All settings<span class="menu__key">${KEY('Mod-,')}</span></button>${phone ? '<button class="word-button" data-ql-close data-k="ql-close">Done</button>' : ''}</div>
  </div>`;
}

/** Lays the popover by its anchor, in the window's own (unscaled) lengths, kept inside it. */
function placePopover(pop, anchor) {
  const win = pop.parentElement;
  const wr = win.getBoundingClientRect();
  const s = wr.width / win.offsetWidth || 1;
  const a = anchor.getBoundingClientRect();
  const gap = 6;
  const [ax, ay, aw, ah] = [(a.left - wr.left) / s, (a.top - wr.top) / s, a.width / s, a.height / s];
  const [pw, ph] = [pop.offsetWidth, pop.offsetHeight];
  let x = Look.place.x === 'end' ? ax + aw - pw : ax;
  let y = Look.place.y === 'above' ? ay - ph - gap : ay + ah + gap;
  x = clamp(x, 8, win.offsetWidth - pw - 8);
  y = clamp(y, 8, win.offsetHeight - ph - 8);
  Object.assign(pop.style, { left: `${x}px`, top: `${y}px` });
}

const quick = {
  /** Opens the popover for the page `kind`, from its control; the keyboard goes into it if asked. */
  open(kind, { keys = false } = {}) {
    if (!Q.open) Q.back = document.activeElement?.closest?.('[data-k]')?.dataset.k ?? null;
    Q.open = { kind, keys, fresh: true };
    draw();
    if (keys || choices().device === 'phone') canvas.querySelector('[data-ql] [tabindex="0"], [data-ql] button')?.focus({ preventScroll: true });
  },
  close(back = true) {
    if (!Q.open) return;
    const { keys } = Q.open;
    Q.open = null;
    draw();
    if (!back) return;
    // Opened from the keys, the keyboard goes back where it was; from the control, to the control.
    const to = keys ? Q.back : Look.anchor(activeKind());
    const el = to && canvas.querySelector(`[data-k="${CSS.escape(to)}"]`);
    (el ?? canvas.querySelector('[data-main-scroll], [data-note]'))?.focus({ preventScroll: true });
  },
  toggle(kind, how) { if (Q.open && Q.open.kind === kind) quick.close(); else quick.open(kind, how); },
  /** A setting changed: at once, nothing to confirm; the page shows it as it's chosen. */
  set(key, value, kind) {
    const s = SCHEMA.find((x) => x.key === key);
    if (!s?.quick) return;
    if (s.type === 'number') { value = clamp(Number(value), s.min, s.max); if (!Number.isFinite(value)) return; }
    else if (!(s.faces ? TEXT_FACES.some((f) => f.id === value) : value in s.choices)) return;
    store(s, kind)[key] = value;
    if (key === 'appearance.scheme') {
      const dark = value === 'night' || (value === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      const b = document.querySelector(`[data-x-set="theme"] [data-value="${dark ? 'dark' : 'light'}"]`);
      if (b && b.getAttribute('aria-pressed') !== 'true') { b.click(); return; }
    }
    draw();
    say(s.quick === 'window' ? `${s.label}: ${s.choices[value]}` : `The ${kind === 'epub' ? 'shelf’s' : 'notes’'} ${s.label.toLowerCase()}: ${s.faces ? faceName(value) : s.type === 'number' ? `${value}%` : s.choices[value]}`);
  },
};

// After every draw: the popover again where it was, the page it acts on lit.
Epub.drawn = (ctx) => {
  const bar = canvas.querySelector('.phone .backbar');
  if (bar && R.phoneView === 'page' && opened() === 'both') bar.insertAdjacentHTML('beforeend', `<button class="other" data-other data-k="other" aria-label="Switch to ${Q.phoneSide === 'epub' ? NOTE.title : BOOK.title}">${icon('swap')}<span>${Q.phoneSide === 'epub' ? NOTE.title : BOOK.title}</span></button>`);
  if (!Q.open) return;
  const phone = ctx.device === 'phone';
  const holder = canvas.querySelector(phone ? '.phone' : '.win');
  const anchor = canvas.querySelector(`[data-k="${CSS.escape(Look.anchor(Q.open.kind))}"]`);
  if (!holder || (!anchor && !phone) || (phone && R.phoneView !== 'page')) { Q.open = null; return; }
  anchor?.setAttribute('aria-expanded', 'true');
  holder.insertAdjacentHTML('beforeend', popoverHtml(Q.open.kind, phone));
  const pop = holder.querySelector('[data-ql]');
  // It arrives once; a change redraws it in place, still.
  if (Q.open.fresh) { pop.classList.add('is-arriving'); Q.open.fresh = false; }
  if (!phone) placePopover(pop, anchor);
  else pop.querySelector('.faces [aria-checked="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
};

Epub.click = (b) => {
  const d = b.dataset;
  if (d.show) { Q.side = d.show; quick.close(false); draw(); }
  else if ('other' in d) { Q.phoneSide = Q.phoneSide === 'epub' ? 'note' : 'epub'; Q.open = null; draw(); }
  else if (d.qlOpen) quick.toggle(d.qlOpen);
  else if (d.qlStep) { const kind = Q.open.kind; quick.set(d.qlKey, Number(valueOf(SCHEMA.find((s) => s.key === d.qlKey), kind)) + Number(d.qlStep), kind); }
  else if (d.qlV) quick.set(d.qlKey, d.qlV, Q.open.kind);
  else if ('qlSettings' in d) { quick.close(); say('In the app, Settings opens at Look → Type'); }
  else if ('qlClose' in d) quick.close();
};

Epub.key = (e) => {
  // ⇧⌘L: the look of the page you're in, from anywhere in the window.
  if (mod(e) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'l') { e.preventDefault(); quick.toggle(activeKind(), { keys: true }); return true; }
  const pop = e.target.closest?.('[data-ql]');
  if (e.key === 'Escape' && Q.open) { e.preventDefault(); quick.close(); return true; }
  if (!pop) return false;
  // Tab and ⇧Tab go round the popover's controls: one stop a setting, as a radio group is.
  if (e.key === 'Tab') {
    const stops = [...pop.querySelectorAll('button:not([disabled])')].filter((b) => b.tabIndex >= 0);
    const i = stops.indexOf(e.target.closest('button'));
    e.preventDefault();
    stops[(i + (e.shiftKey ? -1 : 1) + stops.length) % stops.length]?.focus();
    return true;
  }
  // Arrows choose within a setting, at once, as a radio group's do.
  const group = e.target.closest('[role="radiogroup"]');
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
  if (group && step) {
    e.preventDefault();
    const rs = [...group.querySelectorAll('[role="radio"]')];
    const cols = group.classList.contains('faces') && ['ArrowDown', 'ArrowUp'].includes(e.key) ? getComputedStyle(group).gridTemplateColumns.split(' ').length : 1;
    const next = rs[clamp(rs.indexOf(e.target.closest('[role="radio"]')) + step * cols, 0, rs.length - 1)];
    quick.set(next.dataset.qlKey, next.dataset.qlV, Q.open.kind);
    canvas.querySelector(`[data-k="${CSS.escape(next.dataset.k)}"]`)?.focus();
    return true;
  }
  return true;
};

// A click outside the popover closes it, leaving the keyboard where the click put it.
// Only the popover goes, so what was clicked is still there to take the click.
document.addEventListener('pointerdown', (e) => {
  if (!Q.open || e.target.closest?.('[data-ql], [data-ql-open], .xbar')) return;
  Q.open = null;
  canvas.querySelector('[data-ql]')?.remove();
  for (const el of canvas.querySelectorAll('[data-ql-open][aria-expanded="true"]')) el.setAttribute('aria-expanded', 'false');
  for (const el of canvas.querySelectorAll('.is-back')) el.classList.remove('is-back');
}, true);
// A click or the keyboard in a sheet makes it the one you're in; a page's own look
// control (3) opens that page's look without moving you, so its click isn't redrawn away.
addEventListener('pointerup', (e) => {
  if (e.target.closest?.('[data-ql-open]')) return;
  const s = e.target.closest?.('.duo .blotter[data-side]');
  if (s && s.dataset.side !== Q.side) { Q.side = s.dataset.side; draw(); }
}, true);
addEventListener('focusin', (e) => {
  const s = e.target.closest?.('.duo .blotter[data-side]');
  if (s && s.dataset.side !== Q.side) setTimeout(() => { Q.side = s.dataset.side; draw(); });
});
addEventListener('input', (e) => {
  const note = e.target.closest?.('[data-note]');
  if (note) NOTE.paras = [...note.children].map((el) => el.textContent).filter((t) => t.trim());
});

/** The page: the bar, the window and the notes beside it. */
function mountLookPage({ id, note, notes }) {
  const pages = [['bar', '1 · On the bar'], ['colophon', '2 · In the colophon'], ['page', '3 · On the page']];
  const group = (attr, label, opts) => `<div class="xbar__group" data-x-set="${attr}"><span class="xbar__label">${label}</span>${opts.map(([v, w]) => `<button class="word-button" data-value="${v}">${w}</button>`).join('')}</div>`;
  document.body.insertAdjacentHTML('afterbegin', `
<header class="xbar">
  <span class="xbar__name">Eien · A quick look</span>
  <nav class="xbar__group" aria-label="Directions">${pages.map(([p, w]) => `<a class="word-button" href="look-${p}.html"${p === id ? ' aria-current="page"' : ''}>${w}</a>`).join('')}</nav>
  <span class="xbar__break" aria-hidden="true"></span>
  ${group('open', 'Open', [['both', 'Both'], ['note', 'A note'], ['epub', 'An EPUB']])}
  ${group('device', 'Device', [['desktop', 'Desktop'], ['phone', 'Phone']])}
  ${group('layout', 'Layout', [['band', 'A · Band'], ['slip', 'B · Slip'], ['runhead', 'C · Running head']])}
  ${group('theme', 'Light', [['light', 'Day'], ['dark', 'Night']])}
  ${group('sb', 'Sidebar', [['open', 'Open'], ['shut', 'Shut']])}
  ${group('list', 'List', [['shown', 'Shown'], ['hidden', 'Hidden']])}
  <label class="xbar__group"><span class="xbar__label">Window</span><input type="range" min="900" max="1680" step="20" value="1440" data-win-width aria-label="Window width" /><output></output></label>
  <span class="xnote">${note}</span>
</header>
<main class="stage"><div class="canvas"></div><aside class="notes">${notes}${LOOK_NOTES()}</aside></main>`);
  document.body.append(menu);
  canvas = document.querySelector('.canvas');
  for (const k of ['layout', 'theme', 'sb', 'device', 'width']) if (kept[k]) root.dataset[k] = kept[k];
  root.dataset.theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const width = document.querySelector('[data-win-width]');
  width.value = root.dataset.width ?? '1440';
  root.dataset.width = width.value;
  width.addEventListener('input', () => { root.dataset.width = width.value; draw(); });
  wire();
  wireBar((attr) => { if (attr === 'open') { Q.open = null; R.phoneView = 'page'; } draw(); });
  // The bar's Day and Night are the window's too: the popover's Day or night follows them.
  document.querySelector('[data-x-set="theme"]').addEventListener('click', (e) => {
    const v = e.target.closest('[data-value]')?.dataset.value;
    // Only the writer's own click: the popover's System turns the bar too, and stays System.
    if (v && e.isTrusted) { V.window['appearance.scheme'] = v === 'dark' ? 'night' : 'day'; draw(); }
  });
  addEventListener('resize', () => { fit(); if (Q.open) draw(); });
  document.fonts?.ready.then(() => draw());
}

/** The same in all three. */
const LOOK_NOTES = () => `
  <h2>In all three</h2>
  <ul>
    <li><b>What's in it:</b> Day or night, the typeface, the text's size, line spacing, the page's width and the page's frame, drawn as Settings draws them (a segmented well, face cards set in each face, a stepper), names only: the descriptions stay in Settings. A change shows on the page at once; there's nothing to confirm or cancel. <b>All settings</b> at its foot opens Settings at Look.</li>
    <li><b>Built from the schema:</b> each setting carries a mark, <code>quick: 'window'</code> (one value for every page: Day or night) or <code>quick: 'page'</code> (one for notes and, kept apart, one for books, from the same entry). The popover lists what's marked, in the schema's order, where Settings offers it. A setting marked later shows here with nothing else built. Line spacing (<code>appearance.leading</code>) and Page width (<code>page.width</code>) are new settings: Tight, As set, Loose; Narrow, As set, Wide, a step either side of the face's own.</li>
    <li><b>Two looks, one window:</b> with a note in front, the notes' look; with an EPUB from the shelf, the shelf's, apart, so a note's typeface never changes a book you're reading (#40). Day or night is the window's and says <i>every page</i>. Here the shelf starts in Literata, set loose, so the two are told apart at a glance. The head says <b>SHELF</b>, not BOOKS: in Eien a book is a writer's own manuscript, whose chapters are notes and wear the notes' look.</li>
    <li><b>The key:</b> <kbd>${KEY('Mod-Shift-L')}</kbd> (free in Eien and in CodeMirror's keys as Eien uses them), View → Look…, opens it for the page you're in, the keyboard on its first setting; again, or <kbd>Esc</kbd>, closes it and gives the keyboard back where it was.</li>
    <li><b>From the keyboard:</b> each setting is one stop: <kbd>Tab</kbd> and <kbd>⇧Tab</kbd> go round them (and All settings); arrows choose within one, at once (<kbd>↑</kbd> <kbd>↓</kbd> a row of faces); <kbd>Enter</kbd> or <kbd>Space</kbd> on the stepper's − and +. Opened by a click, <kbd>Esc</kbd> gives the keyboard to the control.</li>
    <li><b>Closing:</b> <kbd>Esc</kbd>, the key again, a click anywhere outside. Choosing another page (the pager, a click in the other sheet) closes it.</li>
    <li><b>By Day and Night:</b> the popover is raised paper with a rule-strong hairline, <code>--eien-radius-m</code> and the float shadow, the layout's corners; by Night the raised paper is the lighter step, as menus are. Choosing Night or Day in it turns the window at once, the popover with it, and it stays open. Nothing in it is the seal's colour: the chosen choice is ink in a rule-strong hairline.</li>
    <li><b>The phone:</b> the popover is a sheet from the screen's foot (<code>--eien-radius-l</code> at its top, the float shadow, no scrim, so the words above show each change), its controls at a finger's size, the faces one row that scrolls sideways; Done closes it. The phone's ⋯ also has Look.</li>
    <li><b>Wide screen</b> (a foldable, a tablet): <b>Panes</b> is the desktop's window at a finger's size, the control where the desktop has it, always shown; <b>One at a time</b> is the phone's; <b>Side by side</b> keeps the phone's bar across both panes, the control with the page's; <b>Two pages</b> is the split, so the look is the active page's, as on the desktop. The notes' drawer over the page has no look of its own.</li>
  </ul>
  <p class="said-note">Text: <i>Pride and Prejudice</i>, Jane Austen (1813), public domain.</p>`;
