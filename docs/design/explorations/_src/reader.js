// Shared by the reader explorations (reader-*.html): Eien's window, in any
// layout, with a book from the vault open in the page pane; or the phone. The
// window is the split family's (split.css), drawn here without a split. Each
// direction sets the page pane (Reader.page), C's running head over it
// (Reader.strip), the phone's page (Reader.phone) and its own keys; the
// book, the shelf section, the contents, paging, marks, finding and the keys
// they share are here.
/*@include:reader-text.js*/

Object.assign(ICONS, {
  pages: '<path d="M3.5 2.5h6l3 3v8h-9z"/><path d="M9.5 2.5v3h3"/>',
  scroll: '<path d="M4.5 2.5h7v11h-7z"/><path d="M8 5.5v5M6.5 7L8 5.5 9.5 7M6.5 9L8 10.5 9.5 9"/>',
  contents: '<path d="M2.5 4h1.5M2.5 8h1.5M2.5 12h1.5"/><path d="M6 4h7.5M6 8h7.5M6 12h5"/>',
  ribbon: '<path d="M5.5 1.5v12.5L8 11.5l2.5 2.5V1.5"/>',
  twisty: '<path d="M6 4.5L10 8l-4 3.5z" fill="currentColor" stroke="none"/>',
  swap: '<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8"/><path d="M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>',
  copy: '<path d="M5.5 5.5h8v8h-8z"/><path d="M10.5 5.5v-3h-8v8h3"/>',
});

// The book. Sixty-one chapters; the first three are its text, the rest their
// lengths alone (spread as the novel's are), so the whole book is counted.
const roman = (n) => [[50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]
  .reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
const BOOK = { title: 'Pride and Prejudice', author: 'Jane Austen', folder: 'Novels', file: 'Novels/Pride and Prejudice.epub' };
const heldChars = BOOK_TEXT.flat().join('').length;
const restEach = (684000 - heldChars) / 58;
const CHAPTERS = Array.from({ length: 61 }, (_, i) => {
  const paras = BOOK_TEXT[i] ?? null;
  const chars = paras ? paras.join('').length : Math.round(restEach * (0.72 + ((i * 37) % 57) / 100));
  return { ord: roman(i + 1), title: `Chapter ${roman(i + 1)}`, paras, chars };
});
const HELD = BOOK_TEXT.length;
const BOOK_CHARS = CHAPTERS.reduce((s, ch) => s + ch.chars, 0);
const charsBefore = (c) => CHAPTERS.slice(0, c).reduce((s, ch) => s + ch.chars, 0);

// The vault's books, in the folders that hold them: a lens over the one tree.
const SHELF = [
  { name: 'Cooking', d: 0, books: [{ title: 'The Boston Cooking-School Cook Book', read: '' }] },
  { name: 'Fic', d: 0, books: [] },
  { name: 'Research', d: 1, parent: 'Fic', books: [{ title: 'The Elements of Style', read: '18%' }] },
  { name: 'Novels', d: 0, books: [{ title: 'North and South', read: 'read' }, { title: 'Persuasion', read: '62%' }, { title: BOOK.title, id: 'pp' }] },
];
const SECTION_NAMES = { shelf: 'Shelf', reading: 'Reading', bookshelf: 'Bookshelf' };
const LAYOUTS = ['band', 'slip', 'runhead'];
const SIDEBAR_W = 264;
const LIST_W = 316;
const C_STRIP = 48;
const WIN_H = 860;
const PHONE = { w: 360, h: 740 };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const root = document.documentElement;

// Where you are and what you've kept. In the app: .eien/reading/, keyed by the book's contents.
const R = {
  c: 2, p: 0, goal: null, nums: null, folds: {},
  bookmarks: [{ c: 0, o: 0 }],
  highlights: [{ id: 1, c: 0, a: 0, b: 117 }, { id: 2, c: 2, a: 0, b: 0 }],
  find: { open: false, q: '', at: -1 },
  phoneView: 'page',
};
let nextHl = 3;
{
  // The second kept highlight: Darcy's "tolerable", wherever it falls.
  const t = CHAPTERS[2].paras;
  let o = 0;
  for (const para of t) { const i = para.indexOf('She is tolerable'); if (i >= 0) { R.highlights[1].a = o + i; R.highlights[1].b = o + i + 'She is tolerable, but not handsome enough to tempt me'.length; break; } o += para.length; }
}

const Reader = {
  id: '', paged: true, list: 'shown',
  page: () => '', strip: null, tools: () => '', phone: () => '', phoneTools: () => '',
  after: () => {}, key: () => false, colophon: null,
};
let canvas;
const STORE = 'eien-reader-explorations';
const kept = (() => { try { return JSON.parse(sessionStorage.getItem(STORE)) ?? {}; } catch { return {}; } })();
function keep() {
  const d = root.dataset;
  try { sessionStorage.setItem(STORE, JSON.stringify({ layout: d.layout, theme: d.theme, sb: d.sb, name: d.name, device: d.device, width: d.width, c: R.c, o: R.nums?.start ?? 0 })); } catch {}
}

function choices() {
  const d = root.dataset;
  return {
    layout: LAYOUTS.includes(d.layout) ? d.layout : 'band',
    sb: d.sb === 'shut' ? 'shut' : 'open',
    list: d.list === 'hidden' ? 'hidden' : 'shown',
    device: d.device === 'phone' ? 'phone' : 'desktop',
    name: SECTION_NAMES[d.name] ? d.name : 'shelf',
    width: clamp(Number(d.width) || 1440, 900, 1680),
  };
}

/** What a direction draws with: the choices, the place, and the pieces every direction shares. */
function context() {
  const ch = choices();
  const sbW = ch.sb === 'shut' ? (ch.layout === 'runhead' ? C_STRIP : 0) : SIDEBAR_W;
  const listW = ch.list === 'hidden' ? 0 : LIST_W;
  const ctx = {
    ...ch, sbW, listW, pageW: ch.width - sbW - listW, c: R.c, chapter: CHAPTERS[R.c],
    section: SECTION_NAMES[ch.name],
    crumb: () => `${BOOK.folder} / ${BOOK.title} / ${CHAPTERS[R.c].ord}`,
    tool: (name, word, key = '', attrs = '') => `<button class="icon-button" data-icon="${name}" data-k="tool-${name}" aria-label="${word}" data-tip="${word}${key ? `  ${key}` : ''}" ${attrs}></button>`,
    /** The views' place holds the book's two: Pages and Scroll. The other one is its exploration. */
    views: () => {
      const v = (icon, word, on, href) => (on
        ? `<button class="icon-button" data-icon="${icon}" data-k="view-${icon}" aria-pressed="true" aria-label="${word}" data-tip="${word}"></button>`
        : `<a class="icon-button" href="${href}" data-icon="${icon}" aria-label="${word}" data-tip="${word}: opens ${href === 'reader-leaf.html' ? 'Pages 2' : 'Scroll 1'} here"></a>`);
      return `<span class="tools" role="group" aria-label="How the book reads">${v('pages', 'Pages', Reader.paged, 'reader-leaf.html')}${v('scroll', 'Scroll', !Reader.paged, 'reader-chapter.html')}</span>`;
    },
    contentsTool: () => ctx.tool('contents', 'Contents', KEY('Mod-2'), 'data-contents aria-haspopup="menu"'),
    /** The page's top: A's band, B's slip; C's tools are in the running head. */
    top: () => {
      const tools = Reader.tools(ctx);
      const f = ctx.findHere();
      if (ch.layout === 'band') return `<div class="band${f ? ' is-finding' : ''}"><span class="tools-row quiet">${ctx.views()}</span>${f}<span class="tools-row quiet">${tools}</span></div>`;
      if (ch.layout === 'slip') return `<div class="topline"><span class="slip quiet${f ? ' is-finding' : ''}">${ctx.views()}<span class="tools-rule" aria-hidden="true"></span>${f ? `${f}<span class="tools-rule" aria-hidden="true"></span>` : ''}${tools}</span></div>`;
      return '';
    },
    /** Find's field, where the layout's tools are, while it's open (Features 1 and 3). */
    findHere: () => (Reader.findInBar && R.find.open ? finder.field() : ''),
    /** The sheet's running head: A's crumb and the author; B's crumb; C's is over the page. */
    head: () => (ch.layout === 'runhead' ? '' : `<div class="sheet__head"><span class="crumb">${ctx.crumb()}</span>${ch.layout === 'band' ? `<span class="crumb">${BOOK.author}</span>` : ''}</div>`),
    /** The colophon: its first item always; the second dropped only when very narrow, the rest when narrow. */
    colophon: (items) => `<footer class="colophon">${items.filter(Boolean).map((it, i) => `<span class="item${i >= 2 ? ' opt' : i === 1 ? ' opt2' : ''}">${i ? '<span class="dot">·</span> ' : ''}${it}</span>`).join('')}<span class="said" role="status" aria-live="polite"></span></footer>`,
    /** A chapter as pages: its flow in columns, `span` of them side by side. */
    leaves: (c, { span = 1, cls = '' } = {}) => `<div class="leaves ${cls}" data-main data-span="${span}" tabindex="0" role="region" aria-roledescription="book" aria-label="${BOOK.title}"><div class="flow book-text" data-c="${c}">${chapterHtml(c)}</div></div>`,
  };
  return ctx;
}

// The text, drawn escaped, with kept highlights and what Find found marked in it.
const fold = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
let hitCache = { q: null, list: [] };
function hits() {
  const q = fold(R.find.q.trim());
  if (!R.find.open || q.length < 2) return [];
  if (hitCache.q === q) return hitCache.list;
  const list = [];
  CHAPTERS.forEach((ch, c) => {
    if (!ch.paras) return;
    let o = 0;
    for (const t of ch.paras) {
      const low = fold(t);
      for (let i = low.indexOf(q); i >= 0; i = low.indexOf(q, i + q.length)) list.push({ c, a: o + i, b: o + i + q.length, p: t, i });
      o += t.length;
    }
  });
  hitCache = { q, list };
  return list;
}
function marked(c, o, t) {
  const end = o + t.length;
  const rs = [];
  for (const h of R.highlights) if (h.c === c && h.a < end && h.b > o) rs.push({ a: Math.max(h.a, o) - o, b: Math.min(h.b, end) - o, cls: 'hl', id: h.id });
  hits().forEach((h, i) => { if (h.c === c && h.a >= o && h.b <= end) rs.push({ a: h.a - o, b: h.b - o, cls: i === R.find.at ? 'hit is-at' : 'hit' }); });
  if (!rs.length) return esc(t);
  const cuts = [...new Set([0, t.length, ...rs.flatMap((r) => [r.a, r.b])])].sort((x, y) => x - y);
  let html = '';
  for (let k = 0; k < cuts.length - 1; k++) {
    const [a, b] = [cuts[k], cuts[k + 1]];
    const on = rs.filter((r) => r.a <= a && r.b >= b);
    const id = on.find((r) => r.id)?.id;
    html += on.length ? `<span class="${on.map((r) => r.cls).join(' ')}"${id ? ` data-hl="${id}"` : ''}>${esc(t.slice(a, b))}</span>` : esc(t.slice(a, b));
  }
  return html;
}
/** A chapter's heading and paragraphs, each paragraph knowing where it starts in the chapter. */
function chapterHtml(c) {
  const ch = CHAPTERS[c];
  const head = `<h2 class="ch-head" data-o="0" data-head>${ch.title}</h2>`;
  if (!ch.paras) return `${head}<p class="not-held">This exploration holds Chapters I to III; the app reads the whole book.</p>`;
  let o = 0;
  return head + ch.paras.map((t) => {
    const lit = R.highlights.some((h) => h.c === c && h.a < o + t.length && h.b > o);
    const html = `<p data-o="${o}"${lit ? ' class="has-hl"' : ''}>${marked(c, o, t)}</p>`;
    o += t.length;
    return html;
  }).join('');
}

/** A place in a chapter (its characters from the start) as a DOM point, and back. */
function pointAt(flow, off) {
  let p = flow.querySelector('p[data-o]');
  for (const each of flow.querySelectorAll('p[data-o]')) if (+each.dataset.o <= off) p = each;
  if (!p) return [flow, 0];
  let left = off - +p.dataset.o;
  const walk = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  for (let node = walk.nextNode(); node; node = walk.nextNode()) { if (left <= node.length) return [node, left]; left -= node.length; }
  return [p, p.childNodes.length];
}
function offsetOf(node, offset) {
  const el = (node.nodeType === 3 ? node.parentElement : node)?.closest?.('[data-o]');
  if (!el) return null;
  if ('head' in el.dataset) return 0;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(node, offset);
  return +el.dataset.o + pre.toString().length;
}
/** The chapter and place under a point on screen. */
function placeAt(x, y) {
  const r = document.caretRangeFromPoint?.(x, y);
  if (!r) return null;
  const o = offsetOf(r.startContainer, r.startOffset);
  const c = (r.startContainer.nodeType === 3 ? r.startContainer.parentElement : r.startContainer)?.closest?.('[data-c]');
  return o == null || !c ? null : { c: +c.dataset.c, o };
}
function rangeOf(flow, a, b) {
  const range = document.createRange();
  range.setStart(...pointAt(flow, a));
  range.setEnd(...pointAt(flow, b));
  return range;
}

// Pages: a chapter flows in columns as tall as the page; a turn moves it a page.
const pageCache = {};
const main = () => canvas.querySelector('.leaves[data-main]');
function layoutLeaves(lv) {
  const flow = lv.querySelector('.flow');
  const span = +lv.dataset.span || 1;
  const gap = parseFloat(getComputedStyle(lv).getPropertyValue('--leaf-gap')) || 48;
  const W = (lv.clientWidth - (span - 1) * gap) / span;
  // A page ends on a whole line: its height is the lines that fit, so no line is cut and facing pages line up.
  const line = parseFloat(getComputedStyle(flow).lineHeight) || 1;
  const H = Math.max(line, Math.floor(lv.clientHeight / line) * line);
  for (const f of [flow, ...lv.querySelectorAll('.flow--measure')]) Object.assign(f.style, { columnCount: String(span), columnGap: `${gap}px`, height: `${H}px`, width: `${lv.clientWidth}px` });
  const count = (f) => Math.max(1, Math.round((f.scrollWidth + gap) / (W + gap)));
  lv._ = { step: W + gap, span, W, gap, pages: count(flow) };
  // Each held chapter measured at this size, once, so every page has its number.
  const key = `${Math.round(W)}x${Math.round(H)}:${root.dataset.face ?? ''}:${span}`;
  if (!pageCache[key]) {
    pageCache[key] = BOOK_TEXT.map((_, c) => {
      if (c === +flow.dataset.c) return lv._.pages;
      const m = document.createElement('div');
      m.className = 'flow book-text flow--measure';
      m.innerHTML = chapterHtml(c);
      Object.assign(m.style, { columnCount: String(span), columnGap: `${gap}px`, height: `${H}px`, width: `${lv.clientWidth}px` });
      lv.append(m);
      const n = count(m);
      m.remove();
      return n;
    });
  }
  lv._.held = pageCache[key];
  return lv._;
}
/** Pages in each chapter, at this size: the held ones measured, the rest by their length. */
function pagesOf(lv, c) {
  const held = lv._.held;
  if (c < HELD) return Math.ceil(held[c] / lv._.span) * lv._.span;
  const perPage = heldChars / held.reduce((s, n) => s + n, 0);
  return Math.max(lv._.span, Math.round(CHAPTERS[c].chars / perPage / lv._.span) * lv._.span);
}
function pagesBefore(lv, c) { let n = 0; for (let k = 0; k < c; k++) n += pagesOf(lv, k); return n; }
/** The page a place falls on, in the chapter shown. */
function pageOf(lv, off) {
  const flow = lv.querySelector('.flow');
  const rect = rangeOf(flow, off, off).getClientRects()[0] ?? rangeOf(flow, off, Math.min(off + 1, CHAPTERS[+flow.dataset.c].chars)).getBoundingClientRect();
  const fr = flow.getBoundingClientRect();
  const scale = fr.width / flow.offsetWidth || 1;
  return clamp(Math.floor((rect.left - fr.left) / scale / lv._.step + 0.02), 0, lv._.pages - 1);
}
function place(lv, still = false) {
  const flow = lv.querySelector('.flow');
  if (still) flow.style.transition = 'none';
  flow.style.transform = `translateX(${-R.p * lv._.step}px)`;
  if (still) { flow.getBoundingClientRect(); flow.style.transition = ''; }
  // Where the page starts is read off the screen, so read it again once the slide is done.
  else flow.addEventListener('transitionend', () => settle(), { once: true });
}
/** Where the shown page starts and ends, in the chapter's characters. */
function pageSpan(lv) {
  const r = lv.getBoundingClientRect();
  const s = r.width / lv.offsetWidth || 1;
  const start = placeAt(r.left + 6 * s, r.top + 6 * s);
  const end = placeAt(r.right - 6 * s, r.bottom - 10 * s);
  const c = +lv.querySelector('.flow').dataset.c;
  return { start: start?.c === c ? start.o : 0, end: end?.c === c ? end.o : CHAPTERS[c].chars };
}

/** Numbers for the colophon, folios and marks: where you are in the chapter and the book. */
function numbers() {
  const lv = main();
  if (lv?._) {
    const { start, end } = pageSpan(lv);
    const before = pagesBefore(lv, R.c);
    let pages = 0;
    for (let c = 0; c < CHAPTERS.length; c++) pages += pagesOf(lv, c);
    return { paged: true, start, end, page: before + R.p + 1, pages, chPage: R.p + 1, chPages: lv._.pages, span: lv._.span, pct: Math.round(((charsBefore(R.c) + start) / BOOK_CHARS) * 100), chapterStart: (c) => pagesBefore(lv, c) + 1,
      /** The page a place falls on, anywhere in the book (within a chapter, by its share of the chapter). */
      pageAt: (c, o) => (c === R.c ? pagesBefore(lv, c) + pageOf(lv, o) + 1 : pagesBefore(lv, c) + Math.floor((o / CHAPTERS[c].chars) * pagesOf(lv, c)) + 1) };
  }
  const sc = canvas.querySelector('[data-main-scroll]');
  if (!sc) return null;
  const r = sc.getBoundingClientRect();
  const s = r.width / sc.offsetWidth || 1;
  const pad = 24 * s;
  const at = placeAt(r.left + r.width / 2, r.top + pad) ?? placeAt(r.left + r.width / 3, r.top + pad * 3) ?? { c: R.c, o: 0 };
  if (at.c !== R.c) { R.c = at.c; Reader.chapterChanged?.(); }
  const chFrac = sc.dataset.mainScroll === 'chapter' ? sc.scrollTop / Math.max(1, sc.scrollHeight - sc.clientHeight) : at.o / CHAPTERS[at.c].chars;
  return { paged: false, start: at.o, end: at.o, pct: Math.round(((charsBefore(at.c) + at.o) / BOOK_CHARS) * 100), chPct: Math.round(chFrac * 100), chapterStart: null };
}

// What the reader does.
const act = {
  turn(dir) {
    const lv = main();
    if (!lv?._) return;
    const np = R.p + dir * lv._.span;
    if (np >= 0 && np < lv._.pages) { R.p = np; place(lv); settle(); }
    else if (dir > 0 && R.c < CHAPTERS.length - 1) { R.c++; R.p = 0; draw(); }
    else if (dir < 0 && R.c > 0) { R.c--; R.p = Infinity; draw(); }
    else say(dir > 0 ? 'The end of the book' : 'The beginning of the book');
  },
  /** Open a chapter at a place in it (its first page by default). */
  go(c, o = 0) { R.c = clamp(c, 0, CHAPTERS.length - 1); R.p = 0; R.goal = o; draw(); },
  chapterEdge(end) { const lv = main(); if (!lv?._) return; R.p = end ? lv._.pages - 1 - ((lv._.pages - 1) % lv._.span) : 0; place(lv); settle(); },
  /** B: a bookmark on this page, or off it. */
  bookmark() {
    const n = R.nums;
    if (!n) return;
    const i = R.bookmarks.findIndex((b) => b.c === R.c && b.o >= n.start && b.o <= Math.max(n.end, n.start));
    if (i >= 0) { R.bookmarks.splice(i, 1); say('Bookmark taken off'); } else { R.bookmarks.push({ c: R.c, o: n.start }); say('Bookmarked'); }
    Reader.marksChanged?.();
    draw();
  },
  /** H: the selection kept as a highlight; on a highlight, it's taken off. */
  highlight() {
    const flow = canvas.querySelector(`.book-text[data-c="${R.c}"]`) ?? canvas.querySelector('.book-text[data-c]');
    const sel = getSelection();
    if (!flow || !sel.rangeCount || sel.isCollapsed) { say('Select some words first: drag over them, or ⇧→'); return; }
    const range = sel.getRangeAt(0);
    const c = +(range.startContainer.parentElement?.closest('[data-c]')?.dataset.c ?? R.c);
    const a = offsetOf(range.startContainer, range.startOffset);
    const b = offsetOf(range.endContainer, range.endOffset);
    if (a == null || b == null || b <= a) return;
    const over = R.highlights.find((h) => h.c === c && h.a <= a && h.b >= b);
    if (over) { R.highlights = R.highlights.filter((h) => h !== over); say('Highlight taken off; ⌘Z puts it back'.replace('⌘Z', KEY('Mod-Z'))); undo = over; } else { R.highlights.push({ id: nextHl++, c, a, b }); say('Highlighted'); }
    sel.removeAllRanges();
    kb = null;
    Reader.marksChanged?.();
    draw();
  },
};
/** Finding in the book: what's typed is matched as text, and only ever drawn escaped. */
const finder = {
  open() { R.find.open = true; draw(); const f = canvas.querySelector('[data-find]'); f?.focus(); f?.select(); },
  close() { R.find = { open: false, q: '', at: -1 }; hitCache = { q: null, list: [] }; draw(); (main() ?? canvas.querySelector('[data-main-scroll]'))?.focus(); },
  set(q) {
    R.find.q = q;
    const list = hits();
    // The first match at or after where you are.
    const here = charsBefore(R.c) + (R.nums?.start ?? 0);
    R.find.at = list.length ? Math.max(0, list.findIndex((h) => charsBefore(h.c) + h.a >= here)) : -1;
    if (R.find.at >= 0) { const h = list[R.find.at]; R.c = h.c; R.p = 0; R.goal = h.a; }
    draw();
    const f = canvas.querySelector('[data-find]');
    if (f) f.setSelectionRange(f.value.length, f.value.length);
  },
  step(dir) {
    const list = hits();
    if (!list.length) return;
    R.find.at = (R.find.at + dir + list.length) % list.length;
    const h = list[R.find.at];
    R.c = h.c; R.p = 0; R.goal = h.a;
    draw();
  },
  /** "3 of 41", or why there's nothing. */
  says() {
    const q = R.find.q.trim();
    if (q.length < 2) return 'Two letters or more';
    const n = hits().length;
    return n ? `${R.find.at + 1} of ${n}` : 'Not in Chapters I–III';
  },
  field(cls = '') {
    return `<span class="find ${cls}" role="search"><span class="find__icon" aria-hidden="true">${icon('search')}</span><input class="field find__field" data-find data-k="find" type="search" value="${esc(R.find.q)}" placeholder="Find in ${esc(BOOK.title)}" aria-label="Find in ${esc(BOOK.title)}" aria-describedby="find-says" autocomplete="off" spellcheck="false" /><span class="count find__says" id="find-says" aria-live="polite">${esc(finder.says())}</span><button class="icon-button" data-find-step="-1" data-k="find-prev" aria-label="Previous match" data-tip="Previous  ${KEY('Shift-Enter')}">${icon('up')}</button><button class="icon-button" data-find-step="1" data-k="find-next" aria-label="Next match" data-tip="Next  Enter">${icon('down')}</button><button class="icon-button" data-find-close data-k="find-close" aria-label="Close Find" data-tip="Close  Esc">${icon('close')}</button></span>`;
  },
};
/** Every kept mark, in the book's order: bookmarks and highlights. */
function marksInOrder() {
  return [...R.bookmarks.map((b) => ({ kind: 'bookmark', c: b.c, o: b.o, b })), ...R.highlights.map((h) => ({ kind: 'highlight', c: h.c, o: h.a, h }))]
    .sort((x, y) => x.c - y.c || x.o - y.o);
}
/** ] and [: to the next mark, or the one before. */
function stepMark(dir) {
  const all = marksInOrder();
  if (!all.length) return;
  const here = charsBefore(R.c) + (dir > 0 ? (R.nums?.end ?? 0) + 1 : (R.nums?.start ?? 0) - 1);
  const at = (m) => charsBefore(m.c) + m.o;
  const next = dir > 0 ? all.find((m) => at(m) >= here) ?? all[0] : [...all].reverse().find((m) => at(m) <= here) ?? all.at(-1);
  act.go(next.c, next.o);
  say(next.kind === 'bookmark' ? 'Bookmark' : 'Highlight');
}
/** A highlight's words, for a list or a tooltip. */
const hlText = (h) => { const t = CHAPTERS[h.c].paras?.join('') ?? ''; return t.slice(h.a, h.b); };
let undo = null;
let kb = null; // a selection made from the keyboard, a sentence at a time: { c, a, b }

/** ⇧→ selects the page's first sentence, then one more each time; ⇧← one fewer. */
function sentenceSelect(dir) {
  const n = R.nums;
  const ch = CHAPTERS[R.c];
  if (!n || !ch.paras) return;
  const ends = [];
  let o = 0;
  for (const t of ch.paras) {
    const re = /[.!?;][”’]?(\s|$)/g;
    let m;
    while ((m = re.exec(t))) ends.push(o + m.index + m[0].trimEnd().length);
    o += t.length;
    if (ends.at(-1) !== o) ends.push(o);
  }
  const starts = [0, ...ends];
  if (!kb || kb.c !== R.c) {
    const a = starts.find((s) => s >= n.start) ?? n.start;
    kb = { c: R.c, a: skipSpace(a), b: ends.find((e) => e > a + 1) ?? a };
  } else if (dir > 0) kb.b = ends.find((e) => e > kb.b) ?? kb.b;
  else { const prev = [...ends].reverse().find((e) => e < kb.b && e > kb.a); if (prev) kb.b = prev; }
  const flow = canvas.querySelector(`.book-text[data-c="${R.c}"]`);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(rangeOf(flow, kb.a, kb.b));
  // Keep the selection's end in sight: turn the page when it runs over.
  const lv = main();
  if (lv?._ && kb.b > n.end) { const p = pageOf(lv, kb.b); if (p !== R.p) { R.p = p - (p % lv._.span); place(lv); settle(); } }
  function skipSpace(at) { const all = ch.paras.join(''); while (/\s/.test(all[at] ?? '')) at++; return at; }
}

/** The page has moved: the numbers, and what each direction shows from them. */
function settle() {
  R.nums = numbers();
  if (!R.nums) return;
  for (const el of canvas.querySelectorAll('[data-fill="pct"]')) el.textContent = `${R.nums.pct}%`;
  if (R.nums.chapterStart) for (const el of canvas.querySelectorAll('[data-fill^="ch-"]')) el.textContent = String(R.nums.chapterStart(+el.dataset.fill.slice(3)));
  const lv = main();
  if (lv) lv.setAttribute('aria-label', `${BOOK.title}, ${CHAPTERS[R.c].title}${R.nums.paged ? `, page ${R.nums.page} of ${R.nums.pages}` : ''}`);
  Reader.after(context(), R.nums);
  keep();
}

// Drawing: the whole window (or the phone) from the state, keeping focus and scroll.
function sidebarHtml(ctx) {
  const sec = (key, label, body) => {
    const open = !R.folds[key];
    return `<div class="sb__sec"><button class="section" data-fold="${key}" data-k="sec-${key}" aria-expanded="${open}"><span class="label">${label}</span><span class="twisty" aria-hidden="true"></span></button></div>${open ? body : ''}`;
  };
  // A row of the tree: a twisty's column (a folder's twisty, or nothing), its name, its count.
  const twist = (open) => `<span class="tw" aria-hidden="true">${open == null ? '' : `<span class="twisty${open ? ' is-open' : ''}"></span>`}</span>`;
  const row = (name, count, d = 0, open = null) => `<div class="trow" style="--d:${d}">${twist(open)}<span class="n">${name}</span>${count}</div>`;
  const group = (d, rows) => `<div class="tgroup" style="--d:${d}">${rows}</div>`;
  const n = (k) => `<span class="count">${k}</span>`;
  const book = (b, d) => `<button class="trow trow--book${b.id ? ' is-chosen' : ''}" style="--d:${d}" data-book="${b.id ?? ''}" data-k="book-${esc(b.title)}"${b.id ? ' aria-current="true"' : ''}>${twist(null)}<span class="n">${esc(b.title)}</span><span class="count"${b.id ? ' data-fill="pct"' : ''}>${b.id ? `${R.nums?.pct ?? 0}%` : b.read}</span></button>`;
  // The shelf keeps the tree's shape: each folder that holds a book, or a folder that does, at its depth.
  const shelfTree = (d, parent) => SHELF.filter((f) => f.d === d && (f.parent ?? null) === parent).map((f) => {
    const inner = shelfTree(d + 1, f.name) + f.books.map((b) => book(b, d + 1)).join('');
    return row(f.name, f.books.length ? n(f.books.length) : '', d, true) + group(d, inner);
  }).join('');
  return `<aside class="sb" aria-label="Sidebar"><div class="sb__head">Eien</div>
    ${sec('library', 'Library', row('All notes', n(214)) + row('Pinned', n(3)))}
    ${sec('folders', 'Folders', row('Cooking', n(12), 0, false) + row('Fic', n(41), 0, true) + group(0, row('Beneath the Walls', `<span class="book-mark">BOOK</span>${n(14)}`, 1, false) + row('Research', n(9), 1, false)) + row('Ideas', n(57), 0, false) + row('Novels', n(2), 0, false))}
    ${sec('tags', 'Tags', row('#draft', n(23)) + row('#fic/aot', n(31)))}
    ${sec('shelf', `<span class="section-name">${ctx.section}</span>`, `<div class="shelf" role="group" aria-label="${ctx.section}: the vault's books">${shelfTree(0, null)}</div>`)}
  </aside>`;
}
function listHtml() {
  const row = (ch, i) => `<button class="row row--ch${i === R.c ? ' is-chosen' : ''}" data-ch="${i}" data-k="ch-${i}"${i === R.c ? ' aria-current="true"' : ''}><span class="t">${ch.title}</span><span class="count" data-fill="ch-${i}"></span></button>`;
  return `<section class="ls" aria-label="Contents of ${BOOK.title}"><div class="ls__band">${Reader.listBand?.() ?? '<span class="field">Search</span>'}</div>
    <div class="ls__head"><div class="ls__title">${BOOK.title}</div><span class="label">${BOOK.author} · 61 chapters · <span data-fill="pct">${R.nums?.pct ?? 0}%</span> read</span></div>
    ${Reader.listHead?.() ?? ''}
    <div class="ls__rows" role="list" data-keep-scroll="list">${Reader.listRows?.() ?? CHAPTERS.map(row).join('')}</div></section>`;
}
function windowHtml(ctx) {
  const strip = Reader.strip ? Reader.strip(ctx) : `<div class="seg">${ctx.findHere() || `<span class="crumb">${ctx.crumb()}</span>`}<span class="tools-row">${ctx.views()}${Reader.tools(ctx)}</span></div>`;
  return `<div class="win" data-layout="${ctx.layout}" data-sb="${ctx.sb}" data-list="${ctx.list}" style="--win-w:${ctx.width}px; --win-h:${WIN_H}px; --eien-sidebar-w:${SIDEBAR_W}px; --eien-list-w:${ctx.listW}px">
  ${ctx.layout === 'runhead' ? `<div class="strip"><div class="strip__panes">${ctx.tool('sidebar', 'Sidebar', KEY('Mod-\\'))}${ctx.tool('list', 'Contents list', '', 'data-toggle-list')}</div><div class="strip__page">${strip}</div></div>` : ''}
  <div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>
  <button class="seal-button seal-btn" data-seal data-k="seal" aria-label="${ctx.sb === 'open' ? 'Hide' : 'Show'} the sidebar" aria-expanded="${ctx.sb === 'open'}" data-tip="${ctx.sb === 'open' ? 'Hide' : 'Show'} the sidebar  ${KEY('Mod-\\')}"><span class="seal">永</span></button>
  ${sidebarHtml(ctx)}
  ${ctx.list === 'shown' ? listHtml() : '<section class="ls" hidden></section>'}
  <main class="pg" aria-label="${BOOK.title}">${Reader.page(ctx)}</main>
</div>`;
}
function phoneHtml(ctx) {
  const view = R.phoneView;
  // The phone lists the shelf's folders by their path, the open book chosen.
  const shelf = `<div class="phone__shelf">${SHELF.filter((f) => f.books.length).map((f) => `<div class="label phone__group">${f.parent ? `${f.parent} / ` : ''}${f.name}</div>${f.books.map((b) => `<button class="phone__row${b.id ? ' is-chosen' : ''}" data-book="${b.id ?? ''}" data-k="pbook-${esc(b.title)}"${b.id ? ' aria-current="true"' : ''}><span>${esc(b.title)}</span><span class="count">${b.id ? `${R.nums?.pct ?? 0}%` : b.read}</span></button>`).join('')}`).join('')}</div>`;
  const contents = `<div class="phone__shelf">${CHAPTERS.map((ch, i) => `<button class="phone__row${i === R.c ? ' is-chosen' : ''}" data-ch="${i}" data-k="pch-${i}"><span>${ch.title}</span><span class="count">${R.nums?.chapterStart ? R.nums.chapterStart(i) : ''}</span></button>`).join('')}</div>`;
  const back = view === 'page' ? `<button class="back" data-phone-view="shelf" data-k="pback"><span data-icon="back"></span>${ctx.section}</button>`
    : `<button class="back" data-phone-view="page" data-k="pback"><span data-icon="back"></span>${BOOK.title}</button>`;
  const body = Reader.phoneViews?.[view] ? Reader.phoneViews[view](ctx)
    : view === 'shelf' ? `<div class="phone__list"><div class="label phone__title">${ctx.section}</div>${shelf}</div>`
      : view === 'contents' ? `<div class="phone__list"><div class="label phone__title">Contents</div>${contents}</div>`
        : Reader.phone(ctx);
  const tools = view === 'page' ? Reader.phoneTools(ctx) : '';
  return `<div class="phone" data-layout="${ctx.layout}" data-view="${view}" style="--slip-n:${(tools.match(/icon-button/g) ?? []).length}">
    <div class="backbar">${back}${ctx.layout === 'band' ? `<span class="tools-row">${tools}</span>` : ''}</div>
    <div class="phone__body">${body}</div>
    ${ctx.layout === 'slip' && tools ? `<div class="slip phone__slip">${tools}</div>` : ''}
    ${ctx.layout === 'runhead' ? `<div class="rail">${tools}</div>` : ''}
  </div>`;
}

let drawn = false;
function draw() {
  const ctx = context();
  if (!canvas) return;
  const focusKey = document.activeElement?.closest?.('[data-k]')?.dataset.k;
  // The book itself has the keyboard: it keeps it through a redraw.
  const hadBook = !!document.activeElement?.matches?.('.leaves[data-main], [data-main-scroll]');
  const scrolls = {};
  for (const el of canvas.querySelectorAll('[data-keep-scroll]')) scrolls[el.dataset.keepScroll] = el.scrollTop;
  canvas.innerHTML = ctx.device === 'phone' ? `<div class="fit">${phoneHtml(ctx)}</div>` : `<div class="fit">${windowHtml(ctx)}</div>`;
  drawIcons(canvas);
  fit();
  for (const el of canvas.querySelectorAll('[data-keep-scroll]')) if (scrolls[el.dataset.keepScroll] != null) el.scrollTop = scrolls[el.dataset.keepScroll];
  const lv = main();
  if (lv) {
    layoutLeaves(lv);
    if (R.goal != null) { R.p = pageOf(lv, R.goal); R.goal = null; }
    R.p = clamp(R.p === Infinity ? lv._.pages - 1 : R.p, 0, lv._.pages - 1);
    R.p -= R.p % lv._.span;
    place(lv, true);
  } else if (R.goal != null) {
    // Scrolling: the place kept (from another exploration, or before a redraw) at the top.
    const sc = canvas.querySelector('[data-main-scroll]');
    const flow = sc?.querySelector(`.book-text[data-c="${R.c}"]`);
    if (flow && R.goal > 0) {
      const r = rangeOf(flow, R.goal, R.goal).getBoundingClientRect();
      const s = sc.getBoundingClientRect();
      sc.scrollTop += (r.top - s.top) / (s.width / sc.offsetWidth || 1) - 48;
    } else if (flow && sc.dataset.mainScroll === 'roll') sc.scrollTop += (flow.getBoundingClientRect().top - sc.getBoundingClientRect().top) / (sc.getBoundingClientRect().width / sc.offsetWidth || 1) - 48;
    R.goal = null;
  }
  Reader.drawn?.(ctx);
  settle();
  canvas.querySelector('.row.is-chosen')?.scrollIntoView({ block: 'nearest' });
  if (focusKey) canvas.querySelector(`[data-k="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
  else if (hadBook) (main() ?? canvas.querySelector('[data-main-scroll]'))?.focus({ preventScroll: true });
  const out = document.querySelector('.xbar output');
  if (out) out.textContent = ctx.device === 'phone' ? 'phone' : `${ctx.width} px`;
  drawn = true;
}
function fit() {
  const box = canvas.querySelector('.fit');
  const el = box?.firstElementChild;
  if (!el) return;
  const phone = choices().device === 'phone';
  const [w, h] = phone ? [PHONE.w, PHONE.h] : [choices().width, WIN_H];
  const scale = Math.min(1, (canvas.clientWidth - 32) / w, (canvas.clientHeight - 32) / h);
  el.style.transform = `scale(${scale})`;
  box.style.width = `${w * scale}px`;
  box.style.height = `${h * scale}px`;
}
let saidTimer;
function say(words) {
  const el = canvas.querySelector('.said') ?? document.querySelector('.xsaid');
  if (!el) return;
  el.textContent = words;
  clearTimeout(saidTimer);
  saidTimer = setTimeout(() => { el.textContent = ''; }, 4000);
}

// The contents as a menu, where the list isn't shown (and the phone's ⋯).
const menu = document.createElement('div');
menu.className = 'menu menu--contents';
menu.setAttribute('role', 'menu');
menu.hidden = true;
let menuBack = null;
function openMenu(items, label, x, y) {
  menuBack = document.activeElement;
  menu.innerHTML = `<div class="menu__head" aria-hidden="true">${esc(label)}</div>${items.map((it) => (it.rule ? '<div class="menu__rule" role="separator"></div>' : `<button class="menu__item" role="menuitem" data-run="${it.run}"${it.current ? ' aria-current="true"' : ''}>${it.icon ? icon(it.icon) : '<span></span>'}<span>${esc(it.word)}</span><span class="menu__key">${esc(it.key ?? '')}</span></button>`)).join('')}`;
  menu.setAttribute('aria-label', label);
  menu.hidden = false;
  const r = menu.getBoundingClientRect();
  menu.style.left = `${clamp(x, 8, innerWidth - r.width - 8)}px`;
  menu.style.top = `${clamp(y, 8, innerHeight - r.height - 8)}px`;
  menu._run = (run) => items.find((it) => it.run === run)?.go();
  (menu.querySelector('[aria-current="true"]') ?? menu.querySelector('.menu__item'))?.focus();
  menu.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest' });
}
function closeMenu(back = true) {
  if (menu.hidden) return;
  menu.hidden = true;
  if (back) menuBack?.focus?.();
}
menu.addEventListener('click', (e) => { const run = e.target.closest('[data-run]')?.dataset.run; if (run) { closeMenu(false); menu._run(run); } });
menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('.menu__item')];
  const i = items.indexOf(document.activeElement);
  const to = { ArrowDown: i + 1, ArrowUp: i - 1, Home: 0, End: items.length - 1 }[e.key];
  if (to !== undefined) { e.preventDefault(); e.stopPropagation(); items[(to + items.length) % items.length].focus(); }
  if (e.key === 'Tab') { e.preventDefault(); closeMenu(); }
  if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); }
});
document.addEventListener('pointerdown', (e) => { if (!menu.contains(e.target)) closeMenu(false); });
function contentsMenu(anchor) {
  const r = anchor.getBoundingClientRect();
  openMenu(CHAPTERS.map((ch, i) => ({ run: `ch${i}`, word: ch.title, key: R.nums?.chapterStart ? String(R.nums.chapterStart(i)) : '', current: i === R.c, go: () => act.go(i) })), 'Contents', r.left - 180, r.bottom + 6);
}

const typing = (el) => el?.closest?.('input, textarea, [contenteditable="true"]');
function wire() {
  canvas.addEventListener('click', (e) => {
    const b = e.target.closest('button, [data-turn]');
    if (!b) {
      // The phone's page: a tap in its outer thirds turns, as a finger does.
      const body = e.target.closest('.phone__body');
      if (body && Reader.paged && R.phoneView === 'page' && getSelection().isCollapsed) {
        const r = body.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        if (x < 0.3) act.turn(-1); else if (x > 0.7) act.turn(1);
      }
      return;
    }
    const d = b.dataset;
    if (d.turn) act.turn(+d.turn);
    else if (d.ch) { R.phoneView = 'page'; act.go(+d.ch); }
    else if ('book' in d) { if (d.book) { R.phoneView = 'page'; draw(); } else say('This exploration holds one book: Pride and Prejudice'); }
    else if (d.fold) { R.folds[d.fold] = !R.folds[d.fold]; draw(); }
    else if ('contents' in d) { if (choices().device === 'phone') { R.phoneView = 'contents'; draw(); } else if (choices().list === 'shown') canvas.querySelector('.row.is-chosen')?.focus(); else contentsMenu(b); }
    else if ('toggleList' in d) document.querySelector(`[data-x-set="list"] [data-value="${choices().list === 'shown' ? 'hidden' : 'shown'}"]`)?.click();
    else if (d.phoneView) { R.phoneView = d.phoneView; draw(); }
    else if ('seal' in d) document.querySelector(`[data-x-set="sb"] [data-value="${choices().sb === 'open' ? 'shut' : 'open'}"]`)?.click();
    else if ('bookmark' in d) act.bookmark();
    else if ('highlight' in d) act.highlight();
    else Reader.click?.(b, e);
  });
  canvas.addEventListener('input', (e) => { if (e.target.matches('[data-find]')) finder.set(e.target.value); });
  canvas.addEventListener('keydown', (e) => {
    if (!e.target.matches('[data-find]')) return;
    if (e.key === 'Enter') { e.preventDefault(); finder.step(e.shiftKey ? -1 : 1); canvas.querySelector('[data-find]')?.focus(); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finder.close(); }
  });
  canvas.addEventListener('click', (e) => {
    const b = e.target.closest('[data-find-step], [data-find-close], [data-mark-go]');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.findStep) { finder.step(+b.dataset.findStep); canvas.querySelector('[data-find]')?.focus(); }
    else if ('findClose' in b.dataset) finder.close();
    else { const [c, o] = b.dataset.markGo.split(':').map(Number); R.phoneView = 'page'; act.go(c, o); }
  }, true);
  canvas.addEventListener('scroll', (e) => { if (e.target.matches?.('[data-main-scroll]')) settle(); }, true);
  // Rows move with the arrows, as Eien's lists do.
  canvas.addEventListener('keydown', (e) => {
    const row = e.target.closest('.row, .trow--book, .phone__row');
    if (!row || !['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const rows = [...row.parentElement.closest('.ls__rows, .shelf, .phone__shelf, .sb').querySelectorAll('.row, .trow--book, .phone__row')];
    rows[clamp(rows.indexOf(row) + (e.key === 'ArrowDown' ? 1 : -1), 0, rows.length - 1)]?.focus();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) return;
    if (Reader.key(e)) return;
    if (mod(e) && e.key === '2') { e.preventDefault(); const row = canvas.querySelector('.row.is-chosen'); if (row) row.focus(); else contentsMenu(canvas.querySelector('[data-contents]') ?? canvas); return; }
    if (Reader.marks && mod(e) && e.key.toLowerCase() === 'f' && !e.altKey) { e.preventDefault(); finder.open(); return; }
    if (mod(e) && e.key === '3') { e.preventDefault(); (main() ?? canvas.querySelector('[data-main-scroll]'))?.focus(); return; }
    if (mod(e) && e.key.toLowerCase() === 'z' && undo) { e.preventDefault(); R.highlights.push(undo); undo = null; Reader.marksChanged?.(); draw(); say('Highlight put back'); return; }
    if (mod(e) || e.altKey || typing(e.target) || e.target.closest?.('.menu, .ls__rows, .sb, .phone__shelf, input')) return;
    const paged = !!main();
    if (paged && (['ArrowRight', 'PageDown'].includes(e.key) || (e.key === ' ' && !e.shiftKey)) && !e.shiftKey) { e.preventDefault(); act.turn(1); }
    else if (paged && (['ArrowLeft', 'PageUp'].includes(e.key) || (e.key === ' ' && e.shiftKey)) && !(e.shiftKey && e.key !== ' ')) { e.preventDefault(); act.turn(-1); }
    else if (paged && e.key === 'Home') { e.preventDefault(); act.chapterEdge(false); }
    else if (paged && e.key === 'End') { e.preventDefault(); act.chapterEdge(true); }
    else if (Reader.marks && e.shiftKey && ['ArrowRight', 'ArrowLeft'].includes(e.key)) { e.preventDefault(); sentenceSelect(e.key === 'ArrowRight' ? 1 : -1); }
    else if (Reader.marks && e.key.toLowerCase() === 'b') { e.preventDefault(); act.bookmark(); }
    else if (Reader.marks && e.key.toLowerCase() === 'h') { e.preventDefault(); act.highlight(); }
    else if (Reader.marks && (e.key === ']' || e.key === '[')) { e.preventDefault(); stepMark(e.key === ']' ? 1 : -1); }
    else if (e.key === 'Escape') { kb = null; getSelection().removeAllRanges(); }
  });
}

/** The page: the bar, the window and the notes beside it. */
function mountReaderPage({ id, note, notes, bar = '', list = 'shown' }) {
  Reader.id = id;
  const groups = [
    ['Pages', [['spread', '1 · The spread'], ['leaf', '2 · One leaf'], ['columns', '3 · Columns']]],
    ['Scroll', [['chapter', '1 · A chapter'], ['roll', '2 · One roll'], ['beside', '3 · Beside a note']]],
    ['Features', [['margin', '1 · On the page'], ['index', '2 · In the list'], ['edge', '3 · On the edge']]],
    ['Showcase', [['room', '1 · The room'], ['set', '2 · Set as a book'], ['lamp', '3 · By lamplight']]],
  ];
  const group = (attr, label, opts) => `<div class="xbar__group" data-x-set="${attr}"><span class="xbar__label">${label}</span>${opts.map(([v, w]) => `<button class="word-button" data-value="${v}">${w}</button>`).join('')}</div>`;
  document.body.insertAdjacentHTML('afterbegin', `
<header class="xbar">
  <span class="xbar__name">Eien · Reading EPUBs</span>
  ${groups.map(([g, pages]) => `<nav class="xbar__group" aria-label="${g}"><span class="xbar__label">${g}</span>${pages.map(([p, w]) => `<a class="word-button" href="reader-${p}.html"${p === id ? ' aria-current="page"' : ''}>${w}</a>`).join('')}</nav>`).join('')}
  <span class="xbar__break" aria-hidden="true"></span>
  ${group('device', 'Device', [['desktop', 'Desktop'], ['phone', 'Phone']])}
  ${group('layout', 'Layout', [['band', 'A · Band'], ['slip', 'B · Slip'], ['runhead', 'C · Running head']])}
  ${group('theme', 'Light', [['light', 'Day'], ['dark', 'Night']])}
  ${group('name', 'Section', [['shelf', 'Shelf'], ['reading', 'Reading'], ['bookshelf', 'Bookshelf']])}
  ${group('sb', 'Sidebar', [['open', 'Open'], ['shut', 'Shut']])}
  ${group('list', 'List', [['shown', 'Shown'], ['hidden', 'Hidden']])}
  ${bar}
  <label class="xbar__group"><span class="xbar__label">Window</span><input type="range" min="900" max="1680" step="20" value="1440" data-win-width aria-label="Window width" /><output></output></label>
  <span class="xnote">${note}</span>
</header>
<main class="stage"><div class="canvas"></div><aside class="notes">${notes}${COMMON_NOTES()}</aside></main>`);
  document.body.append(menu);
  canvas = document.querySelector('.canvas');
  for (const k of ['layout', 'theme', 'sb', 'name', 'device', 'width']) if (kept[k]) root.dataset[k] = kept[k];
  root.dataset.list = list;
  root.dataset.theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (Number.isInteger(kept.c) && kept.c < HELD) { R.c = kept.c; R.goal = kept.o ?? 0; }
  const width = document.querySelector('[data-win-width]');
  width.value = root.dataset.width ?? '1440';
  root.dataset.width = width.value;
  width.addEventListener('input', () => { root.dataset.width = width.value; draw(); });
  wire();
  wireBar(() => { if (R.nums) R.goal = R.nums.start; draw(); });
  addEventListener('resize', () => { fit(); });
  // Pages are counted in the face as it draws: once a face's font arrives, count again, keeping your place.
  const recount = () => { for (const k of Object.keys(pageCache)) delete pageCache[k]; R.goal = R.nums?.start ?? 0; draw(); };
  document.fonts?.ready.then(recount);
  document.fonts?.addEventListener('loadingdone', recount);
}

/** The same in all nine. */
const COMMON_NOTES = () => `
  <h2>In all nine</h2>
  <ul>
    <li><b>Books are files in the vault</b>, <code>.epub</code>, in any folder: Cooking holds its recipe notes and a cookbook side by side. The sidebar's last section lists them, a lens over the one folder tree: every book, under the folders that hold one, at their depth (Fic holds none itself, so it shows only as the way to Research). Its row's count is how far you've read. The folders aren't reworked: choosing Cooking under FOLDERS lists its notes, as now.</li>
    <li><b>The section's name is the owner's call.</b> The bar's Section control renames it in place: <b>Shelf</b> (short, a thing on a desk), <b>Reading</b> (says what you do there, but Reading is already a view of a note: Live · Source · Reading), <b>Bookshelf</b> (plain, but long beside LIBRARY, FOLDERS, TAGS). Book and Library are taken.</li>
    <li><b>Opening a book</b> reads it in the page pane; the note list becomes its contents, chapters in the book's order, each with the page it starts on; the chosen row is the chapter you're in (the selected fill and the seal's rule, as a note's row). With the list hidden, the Contents tool (or ${KEY('Mod-2')}) opens them as a menu.</li>
    <li><b>The views' place holds the book's two:</b> Pages and Scroll, a pressed pair as Live · Source · Reading are. Here the other one opens its exploration, keeping your place.</li>
    <li><b>The book's words are set as Eien sets yours:</b> your Typeface, its size, leading and measure; ${KEY('Mod-+')} and ${KEY('Mod--')} zoom them as they zoom a note. The book's own styles keep only its structure (italics, headings, a centred line), never its fonts or colours, so it reads by Night too.</li>
    <li><b>Safely:</b> each chapter is drawn in a sandboxed frame, with no scripts and no network; the zip is read with sizes capped and no path out of it. Nothing in a book can reach the vault.</li>
    <li><b>Where you were</b>, and your bookmarks and highlights, are kept in <code>.eien/reading/</code>, keyed by the book's contents, so a renamed or moved book keeps them, and they sync with the vault. The book file is never written.</li>
    <li><b>Keys</b> (the book has the keyboard after a click in it, or ${KEY('Mod-3')}): <kbd>→</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd> next page, <kbd>←</kbd> <kbd>⇧Space</kbd> <kbd>PgUp</kbd> back, <kbd>Home</kbd> <kbd>End</kbd> the chapter's start and end; in the list, <kbd>↑</kbd> <kbd>↓</kbd> and <kbd>Enter</kbd>. Scrolling, the usual keys scroll.</li>
    <li><b>The phone</b> (the bar's Device): the book is a page in the phone's stack, the shelf behind its back bar; the book's tools where the layout keeps a phone's (A in the bar, B a floating slip, C a rail).</li>
  </ul>
  <p class="said-note">Text: <i>Pride and Prejudice</i>, Jane Austen (1813), public domain; Chapters I to III here.</p>`;
