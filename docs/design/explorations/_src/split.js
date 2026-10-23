// Shared by the split-window explorations (split-*.html): Eien's window in
// any layout, its page pane holding one note or two. Each direction sets
// Split.page(ctx), the page pane's inside, and Split.strip(ctx), C's running
// head over the page; everything else is here, the same in all three: the
// notes, opening, closing and swapping sides, the divider, the menu, the keys.

Object.assign(ICONS, {
  swap: '<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8"/><path d="M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>',
  side: '<path d="M2.5 3h11v10h-11z"/><path d="M8 3v10"/><path d="M10 6.5v3M8.5 8h3"/>',
  window: '<path d="M2.5 4h9v8.5h-9z"/><path d="M5 4V2.5h8.5V10H11.5"/>',
  open: '<path d="M3 3h10v10H3z"/><path d="M6 8h4"/>',
});

const NOTES = {
  i: { ord: 'i', title: 'The Late Watch', rest: 2815, crumb: 'Fic / Beneath the Walls / i', tags: ['fic/aot'], sealed: 'Sep 2',
    html: '<p>He takes the late watch, every night of the week, and nobody asks why.</p><p>The wall is colder at night than anyone tells the recruits.</p>' },
  ii: { ord: 'ii', title: 'Rations', rest: 2181, crumb: 'Fic / Beneath the Walls / ii', tags: ['fic/aot'], sealed: 'Sep 9',
    html: '<p>Half a loaf, a strip of dried meat, and a promise from the quartermaster.</p><p>The promise is the part that runs out first.</p>' },
  iii: { ord: 'iii', title: 'Below the Gate', rest: 3389, crumb: 'Fic / Beneath the Walls / iii', tags: ['fic/aot', 'draft'], sealed: 'yesterday',
    html: '<p>The water came up through the stones first, before anyone heard it.</p><p>By the time the bell rang, the lower stair was gone.</p>' },
  iv: { ord: 'iv', title: 'What the Recruits Say', rest: 2999, crumb: 'Fic / Beneath the Walls / iv', tags: ['fic/aot', 'draft'], sealed: '2h ago',
    html: '<p>They have a name for him in the barracks, and none of them will say it where he can hear. He does not ask.</p><p>Instead he takes the late watch, every night of the week, and lets them talk around the brazier as if he were part of the stone.</p><p>Erwin finds him there an hour before dawn, and says nothing either.</p>' },
  v: { ord: 'v', title: 'The Long Way Round', rest: 1898, crumb: 'Fic / Beneath the Walls / v', tags: ['fic/aot', 'draft'], sealed: 'never',
    html: '<p>Nobody had walked the outer road in years.</p>' },
  erwin: { ord: '·', title: 'Erwin', rest: 0, crumb: 'Fic / Beneath the Walls / Notes', tags: ['character'], sealed: 'Sep 30',
    html: '<p>Commander. Speaks last in any room, and never twice.</p><p>Knows the recruits’ name for Levi. Has never used it.</p><p>Chapter iv: he comes to the wall before dawn. What does he want? To be told no.</p>' },
};
const LIST = ['i', 'ii', 'iii', 'iv', 'v', 'erwin'];
// A note is plain paragraphs, drawn escaped: what's typed is text, never markup.
for (const n of Object.values(NOTES)) {
  n.paras = n.html.match(/<p>.*?<\/p>/g).map((para) => para.slice(3, -4));
  delete n.html;
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const paraHtml = (id) => NOTES[id].paras.map((t) => `<p>${esc(t)}</p>`).join('');
const plain = (id) => NOTES[id].paras.join(' ');
// A chapter is longer than the lines shown here: `rest` is the words above them.
const wordsOf = (id) => NOTES[id].rest + plain(id).split(/\s+/).filter(Boolean).length;
const MIN_SIDE = 360; // a page narrower than this can't hold the text's measure with any margin

// The split: one or two notes, which side is active, where the divider is.
const S = { sides: ['iv'], active: 0, ratio: 0.5 };
const Split = { page: () => '', strip: () => '' };
let canvas;
const root = document.documentElement;

/** What a direction draws with: the state, and the pieces every layout shares. */
function context() {
  const d = root.dataset;
  const layout = d.layout;
  const winW = +d.width;
  const sbW = d.sb === 'shut' ? (layout === 'runhead' ? 48 : 0) : 264;
  const pageW = winW - sbW - 316;
  const split = S.sides.length === 2;
  // Too narrow for two pages: they fold into one, with a pager between them.
  const folded = split && pageW < MIN_SIDE * 2;
  const ctx = {
    layout, split, folded, pageW, active: S.active, fmt: d.fmt === 'on',
    shown: !split ? [0] : folded ? [S.active] : [0, 1],
    same: split && S.sides[0] === S.sides[1],
    id: (i) => S.sides[i],
    note: (i) => NOTES[S.sides[i]],
    /** Two pages' columns, the divider between: `gap` wide. */
    columns: (gap = 'var(--eien-space-2)') => `calc((100% - ${gap}) * ${S.ratio}) ${gap} minmax(0, 1fr)`,
    tools: (names, cls = '') => `<span class="tools ${cls}">${names.map(([n, w]) => `<button class="icon-button" data-icon="${n}" aria-label="${w}" data-tip="${w}"></button>`).join('')}</span>`,
    views: () => ctx.tools([['live', 'Live'], ['source', 'Source'], ['reading', 'Reading']]),
    pageTools: () => ctx.tools([['compare', 'Compare'], ['versions', 'Versions'], ['focus', 'Focus mode'], ['format', 'Formatting bar']]),
    closeBtn: (i) => `<button class="icon-button close-side" data-close-side="${i}" data-icon="close" aria-label="Close this side: ${NOTES[S.sides[i]].title}" data-tip="Close this side  ${KEY('Mod-W')}"></button>`,
    fmtBar: () => (ctx.fmt ? `<div class="fmt" role="toolbar" aria-label="Formatting">${['bold', 'italic', 'underline', 'strike', 'heading', 'quote', 'bullets', 'link', 'table'].map((n) => `<button class="icon-button" data-icon="${n}" aria-label="${n}" data-tip="${n[0].toUpperCase() + n.slice(1)}"></button>`).join('')}</div>` : ''),
    tagset: (i) => `<span class="tagset">${ctx.note(i).tags.map((t) => `<span>#${t}</span>`).join('')}</span>`,
    /** A note's sheet: its running head (A), slips (B), title and words; `flat` lays it flat on the blotter. */
    sheet: (i, { flat = false, close = false } = {}) => {
      const n = ctx.note(i);
      const head = layout === 'band' ? `<div class="sheet__head"><span class="crumb">${n.crumb}</span>${ctx.tagset(i)}</div>` : layout === 'slip' ? `<div class="sheet__head"><span class="crumb">${n.crumb}</span></div>` : '';
      const slips = layout === 'slip' ? `<div class="slips">${n.tags.map((t) => `<span>#${t}</span>`).join('')}</div>` : '';
      return `<article class="sheet${flat ? ' sheet--flat' : ''}" data-side="${i}">${close ? ctx.closeBtn(i).replace('close-side', 'close-side sheet__close quiet') : ''}${head}<h1>${n.title}</h1>${slips}
        <div class="prose" contenteditable="true" spellcheck="true" data-note="${S.sides[i]}" data-side="${i}" aria-label="${n.title}">${paraHtml(S.sides[i])}</div></article>`;
    },
    /** A note's colophon: its words and last seal; today's tally and what Eien says, on the active one. */
    colophon: (i, { today = i === S.active } = {}) => {
      const n = ctx.note(i);
      const tags = layout === 'runhead' ? n.tags.map((t) => `<span class="pill">#${t}</span>`).join('') : '';
      return `<footer class="colophon" data-side="${i}">${ctx.split ? `${n.ord} <span class="dot">·</span>` : ''}<span data-words="${S.sides[i]}">${wordsOf(S.sides[i]).toLocaleString('en')}</span> words${today ? ' <span class="dot">·</span> today 412' : ''} <span class="dot">·</span> sealed ${n.sealed}${tags ? ` <span class="dot">·</span> ${tags}` : ''}${i === S.active ? '<span class="said" role="status" aria-live="polite"></span>' : ''}</footer>`;
    },
    /** The divider between two pages; its swap shows on hover. */
    divider: () => `<div class="divider" role="separator" aria-orientation="vertical" aria-label="Between the two pages" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(S.ratio * 100)}" tabindex="0" data-tip="Drag to resize · double-click to even"><button class="icon-button divider__swap" data-swap data-icon="swap" aria-label="Swap the sides" data-tip="Swap the sides"></button></div>`,
    /** Folded: one page shows, and a pager names both. */
    pager: () => `<span class="pager" role="group" aria-label="The two pages">${[0, 1].map((i) => `<button class="word-button" data-show-side="${i}" aria-pressed="${i === S.active}">${NOTES[S.sides[i]].title}</button>`).join('')}</span>`,
  };
  return ctx;
}

function windowHtml(ctx) {
  const d = root.dataset;
  const row = (id) => {
    const n = NOTES[id];
    const chosen = S.sides[S.active] === id;
    const beside = ctx.split && !chosen && S.sides.includes(id);
    return `<button class="row${chosen ? ' is-chosen' : ''}${beside ? ' is-beside' : ''}" draggable="true" data-note-row="${id}" aria-current="${chosen ? 'page' : 'false'}"${beside ? ' aria-description="Open on the other side"' : ''}><span class="ord">${n.ord}</span><span class="t">${n.title}</span><span class="count">${wordsOf(id).toLocaleString('en')}</span><span class="p">${esc(plain(id))}</span></button>`;
  };
  const sbRow = (name, count, dd = 0, extra = '') => `<div class="trow${extra}" style="--d:${dd}"><span class="n">${name}</span>${count}</div>`;
  return `<div class="win" data-layout="${ctx.layout}" data-sb="${d.sb}" style="--win-w:${d.width}px">
  ${ctx.layout === 'runhead' ? `<div class="strip"><div class="strip__panes">${ctx.tools([['sidebar', 'Sidebar'], ['list', 'Note list']])}</div><div class="strip__page">${Split.strip(ctx)}</div></div>` : ''}
  <div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>
  <button class="seal-button seal-btn" data-seal aria-label="${d.sb === 'open' ? 'Hide' : 'Show'} the sidebar" aria-expanded="${d.sb === 'open'}" data-tip="${d.sb === 'open' ? 'Hide' : 'Show'} the sidebar  ${KEY('Mod-\\')}"><span class="seal">永</span></button>
  <aside class="sb"><div class="sb__head">Eien</div>
    <div class="sb__sec"><span class="label">Library</span></div>${sbRow('All notes', '<span class="count">214</span>')}${sbRow('Pinned', '<span class="count">3</span>')}
    <div class="sb__sec"><span class="label">Folders</span></div>${sbRow('Fic', '<span class="count">41</span>')}${sbRow('Beneath the Walls', '<span class="book">BOOK</span><span class="count">14</span>', 1, ' is-chosen')}${sbRow('Ideas', '<span class="count">57</span>')}
  </aside>
  <section class="ls" aria-label="Notes"><div class="ls__band"><span class="field">Search</span></div>
    <div class="ls__head"><div class="ls__title">Beneath the Walls</div><span class="label">14 notes · 33,206 words · book</span></div>
    <div role="list">${LIST.map(row).join('')}</div></section>
  <main class="pg" data-active="${S.active}" aria-label="${ctx.split && !ctx.folded ? 'Two pages' : 'Page'}">${Split.page(ctx)}</main>
</div>`;
}

let drawn = null;
/** Draws the window, keeping the caret and each page's scroll where they were. */
function draw() {
  const d = root.dataset;
  if (!d.layout || !d.theme || !d.sb || !d.fmt || !d.width) return;
  const caret = keepCaret();
  const scrolls = [...canvas.querySelectorAll('.blotter')].map((b) => b.scrollTop);
  const ctx = context();
  canvas.innerHTML = `<div class="fit">${windowHtml(ctx)}</div>`;
  drawIcons(canvas);
  canvas.querySelectorAll('.blotter').forEach((b, i) => { b.scrollTop = scrolls[i] ?? 0; });
  drawn = ctx;
  fit();
  caret();
  document.querySelector('.xbar output').textContent = `${d.width} px${ctx.folded ? ' · folded' : ''}`;
}
/** Where the caret is, by side and character, to put it back after a draw. */
function keepCaret() {
  const el = document.activeElement;
  const sel = getSelection();
  if (!el?.classList?.contains('prose') || !sel.rangeCount) return () => {};
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
  range.collapse(node ? true : false);
  getSelection().removeAllRanges();
  getSelection().addRange(range);
}
function fit() {
  const box = canvas.querySelector('.fit');
  const win = box?.firstElementChild;
  if (!win) return;
  const w = +root.dataset.width;
  const scale = Math.min(1, (canvas.clientWidth - 32) / w, (canvas.clientHeight - 32) / 860);
  win.style.transform = `scale(${scale})`;
  box.style.width = `${w * scale}px`;
  box.style.height = `${860 * scale}px`;
}

let saidTimer;
function say(words) {
  const el = canvas.querySelector('.said');
  if (!el) return;
  el.textContent = words;
  clearTimeout(saidTimer);
  saidTimer = setTimeout(() => { el.textContent = ''; }, 5000);
}

// What the writer does.
const act = {
  /** A side becomes the active one: the list, the tools and the keys follow it. */
  activate(i, focus = false) {
    if (i === S.active || i >= S.sides.length) return;
    S.active = i;
    draw();
    if (focus) canvas.querySelector(`.prose[data-side="${i}"]`)?.focus();
  },
  /** A note chosen in the list or sidebar opens in the active page. */
  open(id) { S.sides[S.active] = id; draw(); },
  /** Open to the Side: a second page, or the other one, now active. */
  toSide(id) {
    const at = S.sides.length === 1 ? 1 : 1 - S.active;
    S.sides[at] = id;
    S.active = at;
    draw();
    if (context().folded) say('Too narrow for two pages: they fold into one');
    canvas.querySelector(`.prose[data-side="${S.active}"]`)?.focus();
  },
  close(i) { S.sides.splice(i, 1); S.active = 0; draw(); say('Closed; the note is where it was'); },
  swap() { S.sides.reverse(); S.active = 1 - S.active; draw(); say('Swapped'); },
  /** ⌥⌘\: the note to the side, or, split, the other side closed. */
  toggle() { if (S.sides.length === 2) act.close(1 - S.active); else act.toSide(S.sides[0]); },
};

function wire() {
  // A click in a page makes it the active one, once the caret has landed, so it stays
  // where it was put; the keyboard's focus does the same.
  const activateFrom = (el) => {
    const side = el?.closest?.('[data-side]');
    if (side && drawn?.split && +side.dataset.side !== S.active) act.activate(+side.dataset.side);
  };
  canvas.addEventListener('click', (e) => { if (!e.target.closest('button, .divider')) activateFrom(e.target); });
  canvas.addEventListener('focusin', (e) => { if (e.target.classList.contains('prose')) setTimeout(() => activateFrom(document.activeElement)); });
  // Typing: one document, so the same note in both sides shows it in both.
  canvas.addEventListener('input', (e) => {
    const prose = e.target.closest('.prose');
    if (!prose) return;
    const id = prose.dataset.note;
    NOTES[id].paras = prose.innerText.split(/\n+/).filter((t) => t.trim());
    for (const other of canvas.querySelectorAll(`.prose[data-note="${id}"]`)) {
      if (other === prose) continue;
      other.replaceChildren(...NOTES[id].paras.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
    }
    for (const el of canvas.querySelectorAll(`[data-words="${id}"]`)) el.textContent = wordsOf(id).toLocaleString('en');
  });
  canvas.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.noteRow) (mod(e) ? act.toSide : act.open)(d.noteRow);
    else if (d.closeSide) act.close(+d.closeSide);
    else if ('swap' in d) act.swap();
    else if (d.showSide) act.activate(+d.showSide, true);
    else if ('seal' in d) document.querySelector(`[data-x-set="sb"] [data-value="${root.dataset.sb === 'open' ? 'shut' : 'open'}"]`).click();
  });
  canvas.addEventListener('keydown', (e) => {
    const row = e.target.closest('[data-note-row]');
    if (row && e.key === 'Enter') { e.preventDefault(); (mod(e) ? act.toSide : act.open)(row.dataset.noteRow); }
    if (row && (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) { e.preventDefault(); const r = row.getBoundingClientRect(); openMenu(row.dataset.noteRow, r.left + 24, r.bottom); }
  });
  canvas.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('[data-note-row]');
    if (!row) return;
    e.preventDefault();
    openMenu(row.dataset.noteRow, e.clientX, e.clientY);
  });
  wireDivider();
  wireDrop();
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
    if (!mod(e)) return;
    // ⌘3 goes to the page; pressed in a page, to the other page.
    if (e.key === '3' && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      const inPage = document.activeElement?.classList.contains('prose');
      if (inPage && S.sides.length === 2) act.activate(1 - S.active, true);
      else canvas.querySelector(`.prose[data-side="${S.active}"]`)?.focus();
    }
    if (e.key === '\\' && e.altKey) { e.preventDefault(); act.toggle(); }
  });
}

function wireDivider() {
  let drag = null;
  const set = (ratio) => {
    const ctx = context();
    const min = MIN_SIDE / ctx.pageW;
    S.ratio = Math.min(1 - min, Math.max(min, ratio));
    const pg = canvas.querySelector('.pg');
    for (const el of canvas.querySelectorAll('[data-columns]')) el.style.gridTemplateColumns = ctx.columns(el.dataset.columns || undefined);
    pg.querySelector('.divider')?.setAttribute('aria-valuenow', String(Math.round(S.ratio * 100)));
  };
  canvas.addEventListener('pointerdown', (e) => {
    const div = e.target.closest('.divider');
    if (!div || e.target.closest('button')) return;
    e.preventDefault();
    div.setPointerCapture(e.pointerId);
    div.classList.add('is-dragging');
    drag = { div, rect: div.parentElement.getBoundingClientRect() };
  });
  canvas.addEventListener('pointermove', (e) => { if (drag) set((e.clientX - drag.rect.left) / drag.rect.width); });
  const end = () => { if (drag) { drag.div.classList.remove('is-dragging'); drag = null; } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('dblclick', (e) => { if (e.target.closest('.divider')) set(0.5); });
  canvas.addEventListener('keydown', (e) => {
    if (!e.target.classList?.contains('divider')) return;
    const step = { ArrowLeft: -0.02, ArrowRight: 0.02 }[e.key];
    if (step) { e.preventDefault(); set(S.ratio + step); }
    if (e.key === 'Home') { e.preventDefault(); set(0); }
    if (e.key === 'End') { e.preventDefault(); set(1); }
    if (e.key === 'Enter') { e.preventDefault(); set(0.5); }
  });
}

// Dragging a note from the list: onto the page's right edge, a new page beside;
// onto a page, that page.
function wireDrop() {
  let dragged = null;
  const preview = document.createElement('div');
  preview.className = 'drop-preview';
  const where = (e) => {
    const pg = canvas.querySelector('.pg');
    const r = pg.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    if (S.sides.length === 1 || drawn.folded) return x > 0.6 ? { side: 'new', left: 0.5 } : { side: S.active, left: 0 };
    return x > S.ratio ? { side: 1, left: S.ratio } : { side: 0, left: 0, right: 1 - S.ratio };
  };
  canvas.addEventListener('dragstart', (e) => {
    const row = e.target.closest('[data-note-row]');
    if (!row) return;
    dragged = row.dataset.noteRow;
    e.dataTransfer.setData('text/plain', NOTES[dragged].title);
    e.dataTransfer.effectAllowed = 'copy';
    row.classList.add('is-dragged');
  });
  canvas.addEventListener('dragover', (e) => {
    if (!dragged || !e.target.closest('.pg')) { preview.remove(); return; }
    e.preventDefault();
    const w = where(e);
    const pg = canvas.querySelector('.pg');
    if (preview.parentElement !== pg) pg.append(preview);
    preview.style.left = `${w.left * 100}%`;
    preview.style.right = `${(w.right ?? 0) * 100}%`;
    preview.innerHTML = `<span class="label">${w.side === 'new' ? 'Open to the side' : `Open here, in place of ${NOTES[S.sides[w.side]].title}`}</span>`;
  });
  canvas.addEventListener('dragleave', (e) => { if (!e.relatedTarget || !canvas.querySelector('.pg')?.contains(e.relatedTarget)) preview.remove(); });
  canvas.addEventListener('drop', (e) => {
    if (!dragged || !e.target.closest('.pg')) return;
    e.preventDefault();
    const w = where(e);
    const id = dragged;
    preview.remove();
    if (w.side === 'new') act.toSide(id);
    else { S.active = w.side; act.open(id); }
  });
  canvas.addEventListener('dragend', () => { dragged = null; preview.remove(); canvas.querySelector('.is-dragged')?.classList.remove('is-dragged'); });
}

// A note's right-click menu, with the split's choices.
const menu = document.createElement('div');
menu.className = 'menu';
menu.setAttribute('role', 'menu');
menu.hidden = true;
let menuBack = null;
function openMenu(id, x, y) {
  menuBack = document.activeElement;
  const split = S.sides.length === 2;
  const item = (icon, word, key, run) => `<button class="menu__item" role="menuitem" data-run="${run}">${ICONS[icon] ? `<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[icon]}</svg>` : '<span></span>'}<span>${word}</span><span class="menu__key">${key}</span></button>`;
  menu.innerHTML = `<div class="menu__head" aria-hidden="true">${NOTES[id].title}</div>
    ${item('open', 'Open', 'Enter', 'open')}
    ${item('side', 'Open to the Side', `${KEY('Mod-')}click`, 'side')}
    ${item('window', 'Open in New Window', '', 'window')}
    ${split ? `<div class="menu__rule" role="separator"></div>${item('swap', 'Swap Sides', '', 'swap')}${item('close', 'Close the Other Side', KEY('Alt-Mod-\\'), 'close')}` : ''}`;
  menu.setAttribute('aria-label', NOTES[id].title);
  menu.hidden = false;
  menu.style.left = `${Math.min(x, innerWidth - 280)}px`;
  menu.style.top = `${Math.min(y, innerHeight - menu.offsetHeight - 8)}px`;
  menu.onclick = (e) => {
    const run = e.target.closest('[data-run]')?.dataset.run;
    if (!run) return;
    closeMenu(false);
    if (run === 'open') act.open(id);
    if (run === 'side') act.toSide(id);
    if (run === 'window') say('In the app, a new window opens on this note: see New window & phone');
    if (run === 'swap') act.swap();
    if (run === 'close') act.close(1 - S.active);
  };
  menu.onkeydown = (e) => {
    const items = [...menu.querySelectorAll('.menu__item')];
    const i = items.indexOf(document.activeElement);
    const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
    if (to !== undefined) { e.preventDefault(); items[(to + items.length) % items.length].focus(); }
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

/** The page: the bar, the window and the notes beside it. `bar`: a direction's own choices. */
function mountSplitPage({ id, note, notes, bar = '' }) {
  const pages = [['apart', '1 · Two whole pages'], ['shared', '2 · One set of tools'], ['sheets', '3 · Two sheets'], ['window', 'New window & phone']];
  const group = (attr, label, choices) => `<div class="xbar__group" data-x-set="${attr}"><span class="xbar__label">${label}</span>${choices.map(([v, w]) => `<button class="word-button" data-value="${v}">${w}</button>`).join('')}</div>`;
  document.body.insertAdjacentHTML('afterbegin', `
<header class="xbar">
  <span class="xbar__name">Eien · Split window</span>
  <nav class="xbar__group" aria-label="Directions">${pages.map(([p, w]) => `<a class="word-button" href="split-${p}.html"${p === id ? ' aria-current="page"' : ''}>${w}</a>`).join('')}</nav>
  ${group('layout', 'Layout', [['band', 'A · Band'], ['slip', 'B · Slip'], ['runhead', 'C · Running head']])}
  ${group('theme', 'Light', [['light', 'Day'], ['dark', 'Night']])}
  ${group('sb', 'Sidebar', [['open', 'Open'], ['shut', 'Shut']])}
  ${group('fmt', 'Formatting bar', [['on', 'On'], ['off', 'Off']])}
  ${bar}
  <label class="xbar__group"><span class="xbar__label">Window</span><input type="range" min="900" max="1680" step="20" value="1440" data-win-width aria-label="Window width" /><output></output></label>
  <span class="xnote">${note}</span>
</header>
<main class="stage"><div class="canvas"></div><aside class="notes">${notes}${COMMON_NOTES()}</aside></main>`);
  document.body.append(menu);
  canvas = document.querySelector('.canvas');
  root.dataset.theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  const width = document.querySelector('[data-win-width]');
  root.dataset.width = width.value;
  width.addEventListener('input', () => { root.dataset.width = width.value; draw(); });
  wire();
  wireBar(draw);
  addEventListener('resize', fit);
  // Open to the side from the start, so the split shows; one key or click puts it back.
  S.sides = ['iv', 'erwin'];
  S.active = 0;
  draw();
}

/** The same in all three directions. */
const COMMON_NOTES = () => `
  <h2>In all three</h2>
  <ul>
    <li><b>Side by side</b>, a divider between: drag it, <kbd>←</kbd> <kbd>→</kbd> on it, double-click to even it; neither page narrower than ${MIN_SIDE}px. Top and bottom isn't offered: prose wants its measure, and two short pages of it read worse than one.</li>
    <li><b>Opening:</b> a note's right-click, Open to the Side; <kbd>${KEY('Mod-')}click</kbd> or <kbd>${KEY('Mod-Enter')}</kbd> on a row; drag a row onto the page's right edge; <kbd>${KEY('Alt-Mod-\\')}</kbd> opens the note beside itself (<kbd>${KEY('Mod-\\')}</kbd> is Toggle Sidebar, so the split takes ⌥ with it).</li>
    <li><b>Active page:</b> a click in it, or <kbd>${KEY('Mod-3')}</kbd> (Go to Page), which pressed in a page goes to the other one. The list's chosen row is the active page's note; the other side's note keeps a fainter rule, in pencil, with no fill.</li>
    <li><b>Choosing a note</b> in the list (or the sidebar, with two panes) opens it in the active page.</li>
    <li><b>Closing a side:</b> its × on hover, <kbd>${KEY('Mod-W')}</kbd> in it (the window's ⌘W, while split), or <kbd>${KEY('Alt-Mod-\\')}</kbd> again for the other side. Nothing is lost: the note is where it was. <b>Swapping:</b> the ⇄ on the divider, or the row's menu.</li>
    <li><b>The same note on both sides</b> is one document: type in one and it shows in the other (try ${KEY('Alt-Mod-\\')} with one note open).</li>
    <li><b>Narrow:</b> below ${MIN_SIDE * 2}px of page (the window less the panes beside it), the two pages fold into one, with a pager naming both; <kbd>${KEY('Mod-3')}</kbd> turns between them. Shutting the sidebar or the list unfolds them. The split is never refused, only folded.</li>
    <li><b>Copy as HTML</b>, <b>Seal</b>, <b>Versions</b>, <b>Outline cards</b>, the formatting keys and Find all act on the active page.</li>
  </ul>`;
