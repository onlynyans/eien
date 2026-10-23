// The split window's second set of explorations (split-alt-*.html): Eien's
// window at its real size, in A · Band, B · Slip or C · Running head, with two
// notes open. A direction (mountAlt's `dir`) says where the second note lives
// and draws the page pane; the window round it, the notes, opening, closing and
// swapping, the menu, the keys, the divider and a dragged note are here.

Object.assign(ICONS, {
  swap: '<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8"/><path d="M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>',
  side: '<path d="M2.5 3h11v10h-11z"/><path d="M8 3v10"/><path d="M10 6.5v3M8.5 8h3"/>',
  window: '<path d="M2.5 4h9v8.5h-9z"/><path d="M5 4V2.5h8.5V10H11.5"/>',
  open: '<path d="M3 3h10v10H3z"/><path d="M6 8h4"/>',
  copy: '<path d="M5.5 5.5h8v8h-8z"/><path d="M10.5 5.5v-3h-8v8h3"/>',
  cards: '<path d="M2.5 3h4.5v4.5H2.5zM9 3h4.5v4.5H9zM2.5 8.5h4.5V13H2.5zM9 8.5h4.5V13H9z"/>',
});

const NOTES = {
  i: { ord: 'i', title: 'The Late Watch', rest: 2815, crumb: 'Fic / Beneath the Walls / i', tags: ['fic/aot'], sealed: 'Sep 2',
    paras: ['He takes the late watch, every night of the week, and nobody asks why.', 'The wall is colder at night than anyone tells the recruits.'] },
  ii: { ord: 'ii', title: 'Rations', rest: 2181, crumb: 'Fic / Beneath the Walls / ii', tags: ['fic/aot'], sealed: 'Sep 9',
    paras: ['Half a loaf, a strip of dried meat, and a promise from the quartermaster.', 'The promise is the part that runs out first.'] },
  iii: { ord: 'iii', title: 'Below the Gate', rest: 3389, crumb: 'Fic / Beneath the Walls / iii', tags: ['fic/aot', 'draft'], sealed: 'yesterday',
    paras: ['The water came up through the stones first, before anyone heard it.', 'By the time the bell rang, the lower stair was gone.'] },
  iv: { ord: 'iv', title: 'What the Recruits Say', rest: 2999, crumb: 'Fic / Beneath the Walls / iv', tags: ['fic/aot', 'draft'], sealed: '2h ago',
    paras: ['They have a name for him in the barracks, and none of them will say it where he can hear. He does not ask.', 'Instead he takes the late watch, every night of the week, and lets them talk around the brazier as if he were part of the stone.', 'Erwin finds him there an hour before dawn, and says nothing either.'] },
  v: { ord: 'v', title: 'The Long Way Round', rest: 1898, crumb: 'Fic / Beneath the Walls / v', tags: ['fic/aot', 'draft'], sealed: 'never',
    paras: ['Nobody had walked the outer road in years.'] },
  erwin: { ord: '·', title: 'Erwin', rest: 0, crumb: 'Fic / Beneath the Walls / Notes', tags: ['character'], sealed: 'Sep 30',
    paras: ['Commander. Speaks last in any room, and never twice.', 'Knows the recruits’ name for Levi. Has never used it.', 'Chapter iv: he comes to the wall before dawn. What does he want? To be told no.'] },
};
const BOOK = ['i', 'ii', 'iii', 'iv', 'v', 'erwin'];
// A note is plain paragraphs, drawn escaped: what's typed is text, never markup.
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const paraHtml = (id) => NOTES[id].paras.map((t) => `<p>${esc(t)}</p>`).join('');
const plain = (id) => NOTES[id].paras.join(' ');
// A chapter is longer than the lines shown: `rest` is the words above them.
const wordsOf = (id) => NOTES[id].rest + plain(id).split(/\s+/).filter(Boolean).length;
const words = (id) => wordsOf(id).toLocaleString('en');
const MIN_PAGE = 360;
const SPARE = ['compare', 'copy', 'cards']; // what a narrow bar keeps behind its ⋯ // narrower, a page can't hold the text's measure with any margin
const WIN_H = 860;

// The split: one or two notes, which is active, how the room is shared.
const S = { sides: ['iv', 'erwin'], active: 0, ratio: 0.5, compW: 380, compH: 0.42, listBack: false, said: '', arrive: false };
let DIR = null;
let canvas;
const root = document.documentElement;

/** What a direction draws with: the state, and the pieces every layout shares. */
function context() {
  const d = root.dataset;
  const layout = d.layout;
  const sbW = d.sb === 'shut' ? (layout === 'runhead' ? 48 : 0) : 264;
  const split = S.sides.length === 2;
  const ctx = { layout, split, active: S.active, fmt: d.fmt === 'on', sb: d.sb, winW: +d.width, sbW };
  ctx.listShown = DIR.listShown ? DIR.listShown(ctx) : true;
  ctx.room = ctx.winW - sbW - (ctx.listShown ? 316 : 0);
  ctx.same = split && S.sides[0] === S.sides[1];
  Object.assign(ctx, helpers(ctx));
  ctx.state = DIR.state ? DIR.state(ctx) : '';
  return ctx;
}

/** The pieces: buttons, the views, the formatting bar, a note's head, words and foot. */
function helpers(ctx) {
  const h = {
    id: (i) => S.sides[i],
    note: (i) => NOTES[S.sides[i]],
    /** An icon control: its name, its key in the tooltip, `attrs` for what it does. */
    btn: (icon, label, { key = '', attrs = '', cls = '', tip = '' } = {}) =>
      `<button class="icon-button ${cls}" data-icon="${icon}" aria-label="${esc(label)}" data-tip="${esc(label)}${key ? `  ${KEY(key)}` : ''}"${tip ? ` data-tip-side="${tip}"` : ''} ${attrs}></button>`,
    views: () => `<span class="tools" role="group" aria-label="View">${[['live', 'Live'], ['source', 'Source'], ['reading', 'Reading']].map(([n, w], k) => h.btn(n, w, { attrs: `aria-pressed="${k === 0}" data-say="${w}: the view, for the page you're writing in"` })).join('')}</span>`,
    tool: (name, i, cls = '') => {
      const t = NOTES[S.sides[i ?? S.active]].title;
      const all = {
        compare: ['compare', 'Compare', 'Mod-Shift-D', `Compare: ${t} against its last seal`],
        versions: ['versions', 'Versions', '', `Versions: ${t}'s seals open at the window's right edge`],
        copy: ['copy', 'Copy as HTML', 'Mod-Shift-C', `Copied ${t} as HTML`],
        focus: ['focus', 'Focus mode', 'Mod-Shift-Enter', 'Focus mode: every paragraph but the caret’s fades back'],
        cards: ['cards', 'Outline cards', 'Mod-Shift-O', 'Outline cards: the book’s cards take the page'],
        format: ['format', 'Formatting bar', 'Mod-Shift-B', ''],
      };
      const [icon, label, key, said] = all[name];
      return name === 'format'
        ? h.btn(icon, label, { key, attrs: `aria-pressed="${ctx.fmt}" data-fmt-toggle` })
        : h.btn(icon, label, { key, cls: SPARE.includes(name) ? `tool--spare ${cls}` : cls, attrs: `data-say="${esc(said)}"` });
    },
    /** In a narrow bar, the spare tools go behind one ⋯, which only shows then. */
    spare: (i) => h.btn('more', 'More tools', { cls: 'tool--more', attrs: `data-more="spare" data-for="${i ?? S.active}" aria-haspopup="menu"` }),
    tools: (names, i, cls = '') => `<span class="tools ${cls}">${names.map((n) => h.tool(n, i)).join('')}</span>`,
    closeBtn: (i, cls = '') => h.btn('close', `Close this side: ${NOTES[S.sides[i]].title}`, { key: 'Mod-W', cls: `close-side ${cls}`, attrs: `data-close-side="${i}"` }),
    swapBtn: (cls = 'tool--spare') => h.btn('swap', 'Swap the sides', { cls, attrs: 'data-swap' }),
    fmtBar: (extra = '', attrs = '') => {
      if (!ctx.fmt) return '';
      const runs = [['bold', 'italic', 'underline', 'strike'], ['heading', 'highlight', 'link'], ['quote', 'bullets', 'numbers', 'checklist'], ['table']];
      const name = (n) => ({ bullets: 'Bulleted list', numbers: 'Numbered list', strike: 'Strikethrough' })[n] ?? n[0].toUpperCase() + n.slice(1);
      return `<div class="fmt ${extra}" role="toolbar" aria-label="Format" ${attrs}>${runs.map((run) => run.map((n) => h.btn(n, name(n), { attrs: 'data-format' })).join('')).join('<span class="fmt__rule" aria-hidden="true"></span>')}</div>`;
    },
    crumb: (i, cls = '') => `<span class="crumb ${cls}">${esc(NOTES[S.sides[i]].crumb)}</span>`,
    tagset: (i) => `<span class="tagset">${NOTES[S.sides[i]].tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</span>`,
    slips: (i) => `<div class="slips">${NOTES[S.sides[i]].tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div>`,
    pills: (i) => NOTES[S.sides[i]].tags.map((t) => `<span class="pill">#${esc(t)}</span>`).join(''),
    /** The sheet's running head: A's crumb and tags, B's crumb; C's is the window's strip. */
    head: (i) => (ctx.layout === 'band' ? `<div class="sheet__head">${h.crumb(i)}${h.tagset(i)}</div>`
      : ctx.layout === 'slip' ? `<div class="sheet__head">${h.crumb(i)}</div>` : ''),
    /** The title (B's tag slips under it) and the words, which take the keyboard. */
    words: (i, { title = true } = {}) => {
      const n = h.note(i);
      return `${title ? `<h1 class="title">${esc(n.title)}</h1>` : ''}${ctx.layout === 'slip' && title ? h.slips(i) : ''}
        <div class="prose" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" data-note="${S.sides[i]}" data-side="${i}" aria-label="${esc(n.title)}: its words">${paraHtml(S.sides[i])}</div>`;
    },
    /** A note's figures, in the machine voice: words, and its last seal (the seal's mark is the status line's own). */
    figures: (i, { ord = ctx.split, today = false, keepOrd = false } = {}) => {
      const n = h.note(i);
      const id = S.sides[i];
      // A note outside the book's chapters has no number to give.
      return `${ord && n.ord !== '·' ? `<span class="${keepOrd ? 'kept' : 'opt'}"><span>${esc(n.ord)}</span><span class="dot" aria-hidden="true">·</span></span>` : ''}<span><span data-words="${id}">${words(id)}</span> words</span>${today ? '<span class="opt"><span class="dot" aria-hidden="true">·</span><span>today 412</span></span>' : ''}<span class="dot" aria-hidden="true">·</span><span class="sealed"><span class="sealmark" aria-hidden="true">▪</span> <span class="opt-narrow">sealed </span>${esc(n.sealed)}</span>`;
    },
    said: () => `<span class="said" role="status" aria-live="polite" data-said>${esc(S.said)}</span>`,
  };
  return h;
}

/** The window: the lights, the seal, the sidebar, the list (unless it stepped aside) and the page pane. */
function windowHtml(ctx) {
  const d = root.dataset;
  const tree = DIR.treeNotes?.(ctx) ?? false;
  const trow = (name, count, depth = 0, cls = '') => `<div class="trow${cls}" style="--d:${depth}"><span class="trow__name">${name}</span>${count}</div>`;
  const noteRow = (id, kind) => {
    const n = NOTES[id];
    const chosen = S.sides[S.active] === id;
    const beside = ctx.split && !chosen && S.sides.includes(id);
    const mark = `${chosen ? ' is-chosen' : ''}${beside ? ' is-beside' : ''}`;
    const say = beside ? ` aria-description="Open on the other side"` : '';
    return kind === 'tree'
      ? `<button class="trow trow--note${mark}" style="--d:2" data-note-row="${id}" draggable="true" aria-current="${chosen ? 'page' : 'false'}"${say}><span class="count">${esc(n.ord)}</span><span class="trow__name">${esc(n.title)}</span></button>`
      : `<button class="row${mark}" data-note-row="${id}" draggable="true" aria-current="${chosen ? 'page' : 'false'}"${say}><span class="row__ord">${esc(n.ord)}</span><span class="row__title">${esc(n.title)}</span><span class="count" data-words="${id}">${words(id)}</span><span class="row__preview" data-preview="${id}">${esc(plain(id))}</span></button>`;
  };
  const runhead = ctx.layout === 'runhead'
    ? `<div class="runhead"><div class="runhead__panes">${ctx.btn('sidebar', 'Sidebar', { key: 'Mod-\\', attrs: 'data-sb-toggle' })}${ctx.btn('list', 'Note list', { key: 'Mod-Shift-\\', attrs: 'data-list-toggle aria-pressed="' + ctx.listShown + '"' })}</div><div class="runhead__page">${DIR.strip(ctx)}</div></div>` : '';
  return `<div class="win" data-layout="${ctx.layout}" data-sb="${d.sb}" data-list="${ctx.listShown ? 'shown' : 'away'}" data-dir="${DIR.id}" style="--win-w:${ctx.winW}px; --win-h:${WIN_H}px">
  ${runhead}
  <div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>
  <button class="seal-button seal-btn" data-sb-toggle aria-label="${d.sb === 'open' ? 'Hide' : 'Show'} the sidebar" aria-expanded="${d.sb === 'open'}" data-tip="${d.sb === 'open' ? 'Hide' : 'Show'} the sidebar  ${KEY('Mod-\\')}"><span class="seal" aria-hidden="true">永</span></button>
  <aside class="sb" aria-label="Sidebar"><div class="sb__head">Eien</div>
    <div class="sb__sec"><span class="label">Library</span></div>${trow('All notes', '<span class="count">214</span>')}${trow('Pinned', '<span class="count">3</span>')}
    <div class="sb__sec"><span class="label">Folders</span></div>${trow('Fic', '<span class="count">41</span>')}
    ${trow('Beneath the Walls', '<span class="book-mark">Book</span><span class="count">14</span>', 1, tree ? '' : ' is-chosen')}
    ${tree ? BOOK.map((id) => noteRow(id, 'tree')).join('') : ''}${trow('Ideas', '<span class="count">57</span>')}
  </aside>
  ${ctx.listShown ? `<section class="ls" aria-label="Note list"><div class="ls__band"><label class="search"><svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS.search}</svg><input type="search" placeholder="Search" aria-label="Search notes" /></label>${DIR.listBand?.(ctx) ?? ''}</div>
    <div class="ls__head"><div class="ls__title">Beneath the Walls</div><span class="label">14 notes · 33,206 words · book</span></div>
    <div class="rows">${BOOK.map((id) => noteRow(id, 'list')).join('')}</div></section>` : ''}
  <main class="pg" aria-label="${ctx.split ? 'Two notes' : 'Page'}">${DIR.page(ctx)}</main>
</div>`;
}

let drawn = null;
/** Draws the window, keeping the caret and each scroll where they were. */
function draw() {
  const d = root.dataset;
  if (!d.layout || !d.theme || !d.sb || !d.fmt || !d.width) return;
  const caret = keepCaret();
  const scrolls = Object.fromEntries([...canvas.querySelectorAll('[data-scroll]')].map((el) => [el.dataset.scroll, el.scrollTop]));
  const ctx = context();
  canvas.innerHTML = `<div class="fit">${windowHtml(ctx)}</div>`;
  drawIcons(canvas);
  for (const el of canvas.querySelectorAll('[data-scroll]')) el.scrollTop = scrolls[el.dataset.scroll] ?? 0;
  if (S.arrive && !matchMedia('(prefers-reduced-motion: reduce)').matches) canvas.querySelector('.win').classList.add('is-arriving');
  S.arrive = false;
  drawn = ctx;
  fit();
  caret();
  document.querySelector('.xbar output').textContent = `${d.width} px${ctx.state ? ` · ${ctx.state}` : ''}`;
}
/** Where the caret is, by side and character, to put it back after a draw. */
function keepCaret() {
  const el = document.activeElement;
  const sel = getSelection();
  if (!el?.classList?.contains('prose')) return () => {};
  if (!sel.rangeCount) return () => canvas.querySelector(`.prose[data-side="${el.dataset.side}"]`)?.focus({ preventScroll: true });
  const range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  const at = range.toString().length;
  const side = el.dataset.side;
  return () => {
    const prose = canvas.querySelector(`.prose[data-side="${side}"]`);
    if (prose) placeCaret(prose, at);
  };
}
function placeCaret(prose, at) {
  const walk = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT);
  let left = at;
  let node = walk.nextNode();
  while (node && left > node.length) { left -= node.length; node = walk.nextNode(); }
  prose.focus({ preventScroll: true });
  const range = document.createRange();
  if (node) range.setStart(node, left); else range.selectNodeContents(prose);
  range.collapse(!!node);
  getSelection().removeAllRanges();
  getSelection().addRange(range);
}
/** The window keeps its real size and is scaled to fit what's left of the screen. */
function fit() {
  const box = canvas.querySelector('.fit');
  const win = box?.firstElementChild;
  if (!win) return;
  const w = +root.dataset.width;
  const scale = Math.min(1, (canvas.clientWidth - 32) / w, (canvas.clientHeight - 32) / WIN_H);
  win.style.transform = `scale(${scale})`;
  box.style.width = `${w * scale}px`;
  box.style.height = `${WIN_H * scale}px`;
}

let saidTimer;
/** What Eien says, in the colophon, for a few seconds. */
function say(text) {
  S.said = text;
  for (const el of canvas.querySelectorAll('[data-said]')) el.textContent = text;
  clearTimeout(saidTimer);
  saidTimer = setTimeout(() => { S.said = ''; for (const el of canvas.querySelectorAll('[data-said]')) el.textContent = ''; }, 5000);
}
const focusProse = (i) => canvas.querySelector(`.prose[data-side="${i}"]`)?.focus();

// What the writer does.
const act = {
  /** A side becomes the active one: the list, the tools and the keys follow it. */
  activate(i, focus = false) {
    if (i >= S.sides.length) return;
    if (i !== S.active) { S.active = i; S.arrive = true; draw(); }
    if (focus) focusProse(i);
  },
  /** A note chosen in the list or the tree opens in the active page. */
  open(id) { S.sides[S.active] = id; draw(); },
  /** A note dropped on a page opens there, and that page is active. */
  openAt(i, id) { S.active = i; S.sides[i] = id; draw(); focusProse(i); },
  /** Open to the Side: a second page (or the other one), now active, unless the direction refuses. */
  toSide(id) {
    const refused = DIR.refuse?.(context());
    if (refused) { say(refused); return; }
    const at = S.sides.length === 1 ? 1 : 1 - S.active;
    S.sides[at] = id;
    S.active = at;
    S.arrive = true;
    draw();
    const word = DIR.opened?.(context());
    if (word) say(word);
    focusProse(S.active);
  },
  close(i) {
    const t = NOTES[S.sides[i]].title;
    S.sides.splice(i, 1);
    S.active = 0;
    S.listBack = false;
    draw();
    say(`Closed ${t}: it's in the list as it was`);
  },
  swap() { S.sides.reverse(); S.active = 1 - S.active; draw(); say('Swapped'); },
  /** ⌘D: the note opened beside itself; split, the other side closed. */
  toggle() { if (S.sides.length === 2) act.close(1 - S.active); else act.toSide(S.sides[0]); },
};

function wire() {
  // A click or the keyboard in a page makes it active, once the caret has landed.
  const activateFrom = (el) => {
    const side = el?.closest?.('[data-side]');
    if (side && drawn?.split && +side.dataset.side !== S.active) act.activate(+side.dataset.side);
  };
  canvas.addEventListener('click', (e) => { if (!e.target.closest('button, .divider, a, input')) activateFrom(e.target); });
  canvas.addEventListener('focusin', (e) => { if (e.target.classList.contains('prose')) setTimeout(() => activateFrom(document.activeElement)); });
  // Typing: one document, so the same note on both sides shows it in both, and its counts follow.
  canvas.addEventListener('input', (e) => {
    const prose = e.target.closest('.prose');
    if (!prose) return;
    const id = prose.dataset.note;
    NOTES[id].paras = prose.innerText.split(/\n+/).filter((t) => t.trim());
    for (const other of canvas.querySelectorAll(`.prose[data-note="${id}"]`)) {
      if (other === prose) continue;
      other.replaceChildren(...NOTES[id].paras.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
    }
    for (const el of canvas.querySelectorAll(`[data-words="${id}"]`)) el.textContent = words(id);
    for (const el of canvas.querySelectorAll(`[data-preview="${id}"]`)) el.textContent = plain(id);
  });
  canvas.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.noteRow) (mod(e) ? act.toSide : act.open)(d.noteRow);
    else if (d.closeSide) act.close(+d.closeSide);
    else if ('swap' in d) act.swap();
    else if (d.turn) act.activate(+d.turn, true);
    else if ('sbToggle' in d) document.querySelector(`[data-x-set="sb"] [data-value="${root.dataset.sb === 'open' ? 'shut' : 'open'}"]`).click();
    else if ('fmtToggle' in d) document.querySelector(`[data-x-set="fmt"] [data-value="${root.dataset.fmt === 'on' ? 'off' : 'on'}"]`).click();
    else if ('listToggle' in d) DIR.toggleList ? DIR.toggleList(context()) : say('The note list stays while split, in this direction');
    else if (d.say) say(d.say);
    else if (d.more === 'spare') openMenu(spareMenu(+d.for), b.getBoundingClientRect());
    else if ('more' in d) openMenu(DIR.more(context(), +d.more), b.getBoundingClientRect());
    else DIR.click?.(b, context());
  });
  // Keep the caret in the words when a formatting button is pressed.
  canvas.addEventListener('mousedown', (e) => { if (e.target.closest('[data-format]')) e.preventDefault(); });
  canvas.addEventListener('keydown', (e) => {
    const row = e.target.closest('[data-note-row]');
    if (row && e.key === 'Enter') { e.preventDefault(); (mod(e) ? act.toSide : act.open)(row.dataset.noteRow); }
    if (row && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) { e.preventDefault(); openMenu(rowMenu(row.dataset.noteRow), row.getBoundingClientRect()); }
  });
  canvas.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('[data-note-row]');
    if (!row) return;
    e.preventDefault();
    openMenu(rowMenu(row.dataset.noteRow), { left: e.clientX, bottom: e.clientY });
  });
  wireDivider();
  wireDrop();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
    if (!mod(e) || e.altKey) return;
    // ⌘3 goes to the page; pressed in a page, to the other one.
    if (e.key === '3' && !e.shiftKey) {
      e.preventDefault();
      const inPage = document.activeElement?.classList.contains('prose');
      if (inPage && S.sides.length === 2) act.activate(1 - S.active, true);
      else focusProse(S.active);
    }
    if (e.key.toLowerCase() === 'd' && !e.shiftKey) { e.preventDefault(); act.toggle(); }
  });
}

/** Re-applies each [data-grid]'s tracks, from the state, while the divider is dragged. */
function applyGrids() {
  const ctx = context();
  for (const el of canvas.querySelectorAll('[data-grid]')) {
    const [prop, value] = DIR.grid(el.dataset.grid, ctx);
    el.style[prop] = value;
  }
  for (const div of canvas.querySelectorAll('.divider')) div.setAttribute('aria-valuenow', String(DIR.valueNow(ctx)));
}
const gridStyle = (name, ctx) => { const [prop, value] = DIR.grid(name, ctx); return `data-grid="${name}" style="${prop === 'gridTemplateRows' ? 'grid-template-rows' : 'grid-template-columns'}:${value}"`; };

function wireDivider() {
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const div = e.target.closest('.divider');
    if (!div) return;
    e.preventDefault();
    div.setPointerCapture(e.pointerId);
    div.classList.add('is-dragging');
    drag = { div, axis: div.dataset.axis ?? 'x', box: div.parentElement };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = drag.box.getBoundingClientRect();
    const f = drag.axis === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
    DIR.resize(f, drag.axis === 'x' ? drag.box.offsetWidth : drag.box.offsetHeight, context());
    applyGrids();
  });
  const end = () => { if (drag) { drag.div.classList.remove('is-dragging'); drag = null; } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('dblclick', (e) => { if (e.target.closest('.divider')) { DIR.even(context()); applyGrids(); } });
  canvas.addEventListener('keydown', (e) => {
    const div = e.target.closest?.('.divider');
    if (!div) return;
    const back = div.dataset.axis === 'y' ? 'ArrowUp' : 'ArrowLeft';
    const on = div.dataset.axis === 'y' ? 'ArrowDown' : 'ArrowRight';
    const step = { [back]: -1, [on]: 1, Home: -50, End: 50 }[e.key];
    if (step) { e.preventDefault(); DIR.nudge(step, context()); applyGrids(); }
    if (e.key === 'Enter') { e.preventDefault(); DIR.even(context()); applyGrids(); }
  });
}

/** A divider: the window splitter's role and value; `axis` x is side by side. */
const dividerHtml = (ctx, { axis = 'x', label = 'Between the two pages', cls = '' } = {}) =>
  `<div class="divider ${cls}" data-axis="${axis}" role="separator" aria-orientation="${axis === 'x' ? 'vertical' : 'horizontal'}" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${DIR.valueNow(ctx)}" tabindex="0" title="Drag, or ${axis === 'x' ? '← →' : '↑ ↓'} · double-click to even"></div>`;

// Dragging a note from the list or the tree onto the page pane: where it would land, shown first.
function wireDrop() {
  let dragged = null;
  const preview = document.createElement('div');
  preview.className = 'drop-preview';
  preview.innerHTML = '<span class="label"></span>';
  canvas.addEventListener('dragstart', (e) => {
    const row = e.target.closest('[data-note-row]');
    if (!row) return;
    dragged = row.dataset.noteRow;
    e.dataTransfer.setData('text/plain', NOTES[dragged].title);
    e.dataTransfer.effectAllowed = 'copy';
    row.classList.add('is-dragged');
  });
  const where = (e) => {
    const pg = canvas.querySelector('.pg');
    const r = pg.getBoundingClientRect();
    return { pg, w: DIR.drop(context(), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height) };
  };
  canvas.addEventListener('dragover', (e) => {
    if (!dragged || !e.target.closest('.pg')) { preview.remove(); return; }
    e.preventDefault();
    const { pg, w } = where(e);
    if (preview.parentElement !== pg) pg.append(preview);
    const [l, t, r, b] = w.box;
    Object.assign(preview.style, { left: `${l * 100}%`, top: `${t * 100}%`, right: `${(1 - r) * 100}%`, bottom: `${(1 - b) * 100}%` });
    preview.dataset.edge = w.edge ?? 'left';
    preview.firstElementChild.textContent = w.label;
  });
  canvas.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !canvas.querySelector('.pg')?.contains(e.relatedTarget)) preview.remove(); });
  canvas.addEventListener('drop', (e) => {
    if (!dragged || !e.target.closest('.pg')) return;
    e.preventDefault();
    const { w } = where(e);
    const id = dragged;
    preview.remove();
    if (w.side === 'new') act.toSide(id); else act.openAt(w.side, id);
  });
  canvas.addEventListener('dragend', () => { dragged = null; preview.remove(); canvas.querySelector('.is-dragged')?.classList.remove('is-dragged'); });
}

// The menu: a note's right-click menu, or a direction's own (the companion's ⋯).
const menu = document.createElement('div');
menu.className = 'menu';
menu.setAttribute('role', 'menu');
menu.hidden = true;
let menuBack = null;
/** A note's menu, with the split's choices. */
function rowMenu(id) {
  const split = S.sides.length === 2;
  return { head: NOTES[id].title, items: [
    ['open', 'Open', 'Enter', () => act.open(id)],
    ['side', DIR.sideWord ?? 'Open to the Side', `${KEY('Mod-')}click`, () => act.toSide(id)],
    ['window', 'Open in New Window', '', () => say('A new window opens on this note: see New window & phone')],
    ...(split ? ['|', ['swap', 'Swap Sides', '', () => act.swap()], ['close', 'Close the Other Side', KEY('Mod-D'), () => act.close(1 - S.active)]] : []),
  ] };
}
/** The spare tools, for a note, when its bar is too narrow to show them. */
function spareMenu(i) {
  const t = NOTES[S.sides[i]].title;
  return { head: t, items: [
    ['versions', 'Versions', '', () => say(`Versions: ${t}'s seals open at the window's right edge`)],
    ['compare', 'Compare', KEY('Mod-Shift-D'), () => say(`Compare: ${t} against its last seal`)],
    ['copy', 'Copy as HTML', KEY('Mod-Shift-C'), () => say(`Copied ${t} as HTML`)],
    ['cards', 'Outline cards', KEY('Mod-Shift-O'), () => say('Outline cards: the book’s cards take the page')],
    ...(S.sides.length === 2 ? ['|', ['swap', 'Swap the sides', '', () => act.swap()]] : []),
  ] };
}
function openMenu({ head, items }, at) {
  menuBack = document.activeElement;
  const svg = (name) => (ICONS[name] ? `<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>` : '<span></span>');
  menu.innerHTML = `<div class="menu__head" aria-hidden="true">${esc(head)}</div>${items.map((it, k) => (it === '|' ? '<div class="menu__rule" role="separator"></div>'
    : `<button class="menu__item" role="menuitem" data-run="${k}">${svg(it[0])}<span>${esc(it[1])}</span><span class="menu__key">${esc(it[2])}</span></button>`)).join('')}`;
  menu.setAttribute('aria-label', head);
  menu.hidden = false;
  menu.style.left = `${Math.min(at.left + 8, innerWidth - menu.offsetWidth - 8)}px`;
  menu.style.top = `${Math.min(at.bottom + 4, innerHeight - menu.offsetHeight - 8)}px`;
  menu.onclick = (e) => {
    const k = e.target.closest('[data-run]')?.dataset.run;
    if (k === undefined) return;
    closeMenu(false);
    items[+k][3]();
  };
  menu.onkeydown = (e) => {
    const all = [...menu.querySelectorAll('.menu__item')];
    const i = all.indexOf(document.activeElement);
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: all.length - 1 }[e.key];
    if (to !== undefined) { e.preventDefault(); all[(to + all.length) % all.length].focus(); }
    if (e.key === 'Tab') { e.preventDefault(); closeMenu(); }
  };
  menu.querySelector('.menu__item').focus();
}
function closeMenu(back = true) {
  if (menu.hidden) return;
  menu.hidden = true;
  if (back) menuBack?.focus?.();
}
document.addEventListener('pointerdown', (e) => { if (!menu.contains(e.target)) closeMenu(false); });

/** The exploration: its bar, the window, and the notes beside it. */
function mountAlt(dir) {
  DIR = dir;
  const mine = [['facing', '4 · Facing pages'], ['companion', '5 · A companion'], ['follow', '6 · Tools that follow']];
  const earlier = [['apart', '1'], ['shared', '2'], ['sheets', '3'], ['window', 'New window']];
  const group = (attr, label, choices) => `<div class="xbar__group" data-x-set="${attr}"><span class="xbar__label">${label}</span>${choices.map(([v, w]) => `<button class="word-button" data-value="${v}">${w}</button>`).join('')}</div>`;
  document.body.insertAdjacentHTML('afterbegin', `
<header class="xbar">
  <span class="xbar__name">Eien · Split window, more</span>
  <nav class="xbar__group" aria-label="These directions">${mine.map(([p, w]) => `<a class="word-button" href="split-alt-${p}.html"${p === dir.id ? ' aria-current="page"' : ''}>${w}</a>`).join('')}</nav>
  <nav class="xbar__group" aria-label="The first three"><span class="xbar__label">Earlier</span>${earlier.map(([p, w]) => `<a class="word-button" href="split-${p}.html">${w}</a>`).join('')}</nav>
  ${group('layout', 'Layout', [['band', 'A · Band'], ['slip', 'B · Slip'], ['runhead', 'C · Running head']])}
  ${group('theme', 'Light', [['light', 'Day'], ['dark', 'Night']])}
  ${group('sb', 'Sidebar', [['open', 'Open'], ['shut', 'Shut']])}
  ${group('fmt', 'Formatting bar', [['on', 'On'], ['off', 'Off']])}
  <label class="xbar__group"><span class="xbar__label">Window</span><input type="range" min="900" max="1680" step="20" value="1440" data-win-width aria-label="Window width" /><output></output></label>
  <span class="xnote">${dir.line}</span>
</header>
<div class="stage"><div class="canvas"></div><aside class="notes" aria-label="About this direction">${dir.notes}${COMMON_NOTES()}</aside></div>`);
  document.body.append(menu);
  canvas = document.querySelector('.canvas');
  root.dataset.theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const width = document.querySelector('[data-win-width]');
  root.dataset.width = width.value;
  width.addEventListener('input', () => { root.dataset.width = width.value; draw(); });
  wire();
  wireBar(draw);
  addEventListener('resize', fit);
  draw();
}

/** The same in all three of these. */
const COMMON_NOTES = () => `
  <h2>In all three of these</h2>
  <ul>
    <li><b>Opening:</b> a note's right-click, Open to the Side; <kbd>${KEY('Mod-')}click</kbd> or <kbd>${KEY('Mod-Enter')}</kbd> on a row; drag a row onto the page's right edge (a preview shows where it lands; dropped on a page, it opens there); <kbd>${KEY('Mod-D')}</kbd> opens the note beside itself, and split, closes the other side.</li>
    <li><b>Why ${KEY('Mod-D')}:</b> it's free in the menu and in the editor. <kbd>${KEY('Mod-\\')}</kbd> is Toggle Sidebar, and <kbd>${KEY('Alt-Mod-\\')}</kbd>, which 1–3 use, is CodeMirror's Indent Selection in the default keymap Eien's editor loads. ${KEY('Mod-D')} splits a pane in terminals too.</li>
    <li><b>Changing the active page:</b> a click in it, or <kbd>${KEY('Mod-3')}</kbd> (Go to Page), which pressed in a page goes to the other one. The list's chosen row is the active page's note; the other open note keeps a hairline-strength rule and no fill.</li>
    <li><b>Choosing a note</b> in the list or the tree opens it in the active page.</li>
    <li><b>Closing</b> never touches a note: it's in the list as it was. <kbd>${KEY('Mod-W')}</kbd> in a side closes that side first.</li>
    <li><b>The same note on both sides</b> is one document: type in one, it shows in the other (try ${KEY('Mod-D')} with one note open). Seals, counts and undo are the note's.</li>
    <li><b>Not offered:</b> the split on a phone, which holds one page; each direction says what it does instead. New Window is on <a href="split-window.html">split-window.html</a>.</li>
  </ul>`;
