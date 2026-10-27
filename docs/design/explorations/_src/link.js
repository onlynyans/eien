// Shared by the three link explorations (link-*.html): a note in Live with
// [[wiki links]] and web links in it, typed in as the page is; the file beside
// it, redrawn as it changes; the keys, the click, following, undo. Each page
// adds only its own way of showing and editing a link, by setting the hooks
// on `Links` (onHover, onCaret, onEdit, ...) and, for 2, Links.render.
//
// What's typed is text, never markup: the page is drawn with DOM nodes and
// textContent, so nothing typed or read from the page goes through innerHTML.

Object.assign(ICONS, {
  openLink: '<path d="M9.5 2.5h4v4"/><path d="M13.5 2.5L8 8"/><path d="M11.5 9.5v4h-9v-9h4"/>',
  copy: '<path d="M5.5 5.5h8v8h-8z"/><path d="M10.5 5.5v-3h-8v8h3"/>',
  unlink: '<path d="M8.6 5l1.2-1.2a2.4 2.4 0 0 1 3.4 3.4L12 8.4"/><path d="M7.4 11l-1.2 1.2a2.4 2.4 0 0 1-3.4-3.4L4 7.6"/><path d="M3 3l1.6 1.6M13 13l-1.6-1.6"/>',
  note: '<path d="M4 2.5h5.5L12 5v8.5H4z"/><path d="M9.5 2.5V5H12"/><path d="M6 8h4M6 10.5h3"/>',
  web: '<circle cx="8" cy="8" r="5.5"/><path d="M2.5 8h11"/><path d="M8 2.5c1.5 1.6 2.3 3.4 2.3 5.5S9.5 11.9 8 13.5C6.5 11.9 5.7 10.1 5.7 8S6.5 4.1 8 2.5z"/>',
});

const MAC_KEYS = /Mac|iPhone|iPad/.test(navigator.platform);
/** ⌘-click or Ctrl-click, as this system writes it. */
const MOD_CLICK = MAC_KEYS ? '⌘-click' : 'Ctrl-click';
const ALT_CLICK = MAC_KEYS ? '⌥-click' : 'Alt-click';

// The vault's notes a [[link]] can name, as the card and the bar describe them.
const BOOK = 'Fic / Beneath the Walls';
const VAULT = {
  'The Late Watch': { ord: 'i', words: 2840, sealed: 'Sep 2', first: 'He takes the late watch, every night of the week, and nobody asks why.' },
  Rations: { ord: 'ii', words: 2204, sealed: 'Sep 9', first: 'Half a loaf, a strip of dried meat, and a promise from the quartermaster.' },
  'Below the Gate': { ord: 'iii', words: 3412, sealed: 'yesterday', first: 'The water came up through the stones first, before anyone heard it.' },
  'What the Recruits Say': { ord: 'iv', words: 3051, sealed: '2h ago', first: 'They have a name for him in the barracks, and none of them will say it where he can hear.' },
  'The Long Way Round': { ord: 'v', words: 1912, sealed: 'not yet', first: 'Nobody had walked the outer road in years.' },
};
/** A note by its title, as a wiki link names it: case doesn't matter. */
const titleOf = (name) => Object.keys(VAULT).find((t) => t.toLowerCase() === name.trim().toLowerCase());
/** The first note whose title starts with what's typed: what a field offers to finish. */
const completion = (typed) => {
  const t = typed.toLowerCase();
  if (!t) return '';
  const hit = Object.keys(VAULT).find((title) => title.toLowerCase().startsWith(t) && title.length > t.length);
  return hit ? hit.slice(typed.length) : '';
};

// The note, as the file holds it: one paragraph a line.
const SOURCE = [
  'Erwin’s speech in [[What the Recruits Say|chapter iv]] needs the wall’s height: fifty metres, by the [fandom wiki](https://attackontitan.fandom.com/wiki/Wall_Maria).',
  'Check the flood against [[Below the Gate]] before it’s posted, and the timeline in [[The Outer Road]], once that note exists.',
  'Post to [AO3](https://archiveofourown.org/works/48151623) on Friday, with Levi’s line from [[Rations]] as the summary.',
];
const FILE_PATH = 'fic/beneath-the-walls/notes-for-iv.md';

// A paragraph is its words and the links over them: what Live shows with the marks hidden.
// A note link's target is null while its words are its target ([[Below the Gate]]).
const LINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[((?:\\.|[^\]\\])+)\]\(([^)\s]*)\)/g;
function parse(line) {
  let text = '';
  let last = 0;
  const links = [];
  for (const m of line.matchAll(LINK_RE)) {
    text += line.slice(last, m.index);
    const start = text.length;
    // A web link's words keep \\, \[ and \] escaped in the file; the page shows them plain.
    text += m[1] !== undefined ? (m[2] ?? m[1]) : m[3].replace(/\\([\\[\]])/g, '$1');
    links.push(m[1] !== undefined
      ? { kind: 'note', target: m[2] !== undefined ? m[1].trim() : null, start, end: text.length }
      : { kind: 'web', target: m[4], start, end: text.length });
    last = m.index + m[0].length;
  }
  return { text: text + line.slice(last), links };
}
/** The paragraph back as Markdown: what Eien saves. */
function markdown(par) {
  let out = '';
  let at = 0;
  for (const l of par.links) {
    const words = par.text.slice(l.start, l.end);
    out += par.text.slice(at, l.start);
    if (l.kind === 'note') out += l.target === null ? `[[${words}]]` : `[[${l.target}|${words}]]`;
    else out += `[${words.replace(/([\\[\]])/g, '\\$1')}](${l.target.replace(/ /g, '%20').replace(/\)/g, '%29')})`;
    at = l.end;
  }
  return out + par.text.slice(at);
}
const wordsOf = (par, l) => par.text.slice(l.start, l.end);
const targetOf = (par, l) => (l.kind === 'note' ? (l.target ?? wordsOf(par, l)) : l.target);
/** What a typed target is: an address goes to the web; anything else names a note. */
const isAddress = (s) => /^(https?:|mailto:)/i.test(s) || /^www\./i.test(s) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s);
const asAddress = (s) => (/^[a-z][\w+.-]*:/i.test(s) ? s : `https://${s}`);

let DOC = SOURCE.map(parse);

/** The hooks each direction sets. `at` is a link: { p, i }, its paragraph and its place there. */
const Links = {
  hoverDelay: 400,
  onHover() {}, onUnhover() {},
  onCaret() {}, onPlace() {}, onTyping() {},
  onEdit() {}, onReach() {}, onKey() { return false; },
  onLayout() {}, onBar() {},
  /** Draws a link's span, or something round it; 2 opens the Markdown here. */
  render: null,
  /** The link the caret is held in, drawn its way (2's open link). */
  opened: null,
};
const same = (a, b) => !!a && !!b && a.p === b.p && a.i === b.i;
const linkOf = (at) => DOC[at.p]?.links[at.i];

/** Where a link goes, as the card, the bar and the colophon say it. */
function describe(at) {
  const par = DOC[at.p];
  const l = par.links[at.i];
  const words = wordsOf(par, l);
  if (l.kind === 'note') {
    const name = targetOf(par, l);
    const title = titleOf(name);
    if (!title) return { kind: 'missing', title: name.trim(), words, short: `${name.trim()} · no note yet` };
    const n = VAULT[title];
    return { kind: 'note', title, words, ...n, crumb: `${BOOK} / ${n.ord}`, short: `${n.ord} · ${title}` };
  }
  if (!l.target) return { kind: 'empty', words, short: 'no address yet' };
  const m = l.target.match(/^[a-z][\w+.-]*:\/\/([^/?#]+)(.*)$/i);
  const host = m ? m[1].replace(/^www\./, '') : l.target;
  const path = m ? m[2] : '';
  return { kind: 'web', words, url: l.target, host, path, short: host + (path.length > 18 ? `${path.slice(0, 17)}…` : path) };
}

// ---- The page every direction shares: the explorations' bar, the window's page pane, the file.

let prose, sheet, page, pane, src, whereEl, said, sr;
function mountLinkPage({ id, note, notes, bar = '' }) {
  const pages = [['card', '1 · A card'], ['inline', '2 · In place'], ['bar', '3 · A bar']];
  const group = (attr, label, choices) => `<div class="xbar__group" data-x-set="${attr}"><span class="xbar__label">${label}</span>${choices.map(([v, w]) => `<button class="word-button" data-value="${v}">${w}</button>`).join('')}</div>`;
  const tool = (n, w) => `<button class="icon-button" data-icon="${n}" data-view="${n}" aria-label="${w}" data-tip="${w}"></button>`;
  document.body.insertAdjacentHTML('afterbegin', `
<header class="xbar">
  <span class="xbar__name">Eien · A link in Live</span>
  <nav class="xbar__group" aria-label="Directions">${pages.map(([p, w]) => `<a class="word-button" href="link-${p}.html"${p === id ? ' aria-current="page"' : ''}>${w}</a>`).join('')}</nav>
  ${group('theme', 'Light', [['light', 'Day'], ['dark', 'Night']])}
  ${group('layout', 'Layout', [['band', 'A · Band'], ['slip', 'B · Slip'], ['runhead', 'C · Running head']])}
  ${group('device', 'Show', [['desktop', 'Desktop'], ['phone', 'Phone']])}
  ${group('click', 'A plain click', [['caret', 'Places the caret'], ['follow', 'Follows']])}
  ${group('fmt', 'Formatting bar', [['off', 'Off'], ['on', 'On']])}
  ${bar}
  <span class="xnote">${note}</span>
</header>
<main class="stage">
  <div class="pane">
    <div class="ptop">
      <span class="phone-back">${tool('back', 'Back to the list')}<span class="phone-back__name">Notes for iv</span>${tool('more', 'More')}</span>
      <span class="ptop__slip">
        <span class="ptop__tools ptop__views" role="group" aria-label="Views">${tool('live', 'Live')}${tool('source', 'Source')}${tool('reading', 'Reading')}</span>
        <span class="ptop__crumb label">Fic / Beneath the Walls / Notes</span>
        <span class="ptop__tools">${tool('compare', 'Compare')}${tool('versions', 'Versions')}${tool('focus', 'Focus mode')}${tool('format', 'Formatting bar')}</span>
      </span>
    </div>
    <div class="fmt" role="toolbar" aria-label="Formatting">
      ${['bold', 'italic', 'underline', 'strike'].map((n) => tool(n, n[0].toUpperCase() + n.slice(1))).join('')}<span class="fmt__rule"></span>
      ${tool('heading', 'Heading')}${tool('highlight', 'Highlight')}<button class="icon-button fmt__link" data-icon="link" aria-label="Link" aria-pressed="false" data-tip="Link  ${KEY('Mod-K')}"></button><span class="fmt__rule"></span>
      ${['quote', 'bullets', 'numbers', 'checklist'].map((n) => tool(n, n[0].toUpperCase() + n.slice(1))).join('')}
    </div>
    <div class="page">
      <article class="sheet">
        <div class="sheet__head"><span class="label">Fic / Beneath the Walls / Notes</span><span class="tagset">fic/aot · planning</span></div>
        <h1 class="title">Notes for iv</h1>
        <div class="prose" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="Notes for iv, in Live"></div>
      </article>
    </div>
    <footer class="colophon"><span class="colophon__where"></span><span class="colophon__said" role="status" aria-live="polite"></span></footer>
    <span class="sr" role="status" aria-live="polite"></span>
  </div>
  <aside class="file" aria-label="The file">
    <div class="file__head"><span class="label">The file</span><span class="count">${FILE_PATH}</span></div>
    <pre class="file__src" aria-label="The note’s Markdown, as saved"></pre>
    <div class="file__notes">${notes}</div>
  </aside>
</main>`);
  pane = document.querySelector('.pane');
  page = pane.querySelector('.page');
  sheet = pane.querySelector('.sheet');
  prose = pane.querySelector('.prose');
  src = document.querySelector('.file__src');
  whereEl = pane.querySelector('.colophon__where');
  said = pane.querySelector('.colophon__said');
  sr = pane.querySelector('.sr');
  const root = document.documentElement;
  root.dataset.theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  wireBar((attr) => {
    if (attr === 'device') setTouch();
    Links.onBar(attr);
    requestAnimationFrame(() => Links.onLayout());
  });
  matchMedia('(hover: none)').addEventListener('change', setTouch);
  addEventListener('resize', () => Links.onLayout());
  page.addEventListener('scroll', () => Links.onLayout());
  drawIcons();
  wireChrome();
  wireProse();
  draw();
}
/** Touch: a phone shown here, or a pointer that can't hover. Nothing waits for a hover then. */
function setTouch() {
  const root = document.documentElement;
  root.classList.toggle('is-touch', root.dataset.device === 'phone' || matchMedia('(hover: none)').matches);
}
const isTouch = () => document.documentElement.classList.contains('is-touch');
const clickFollows = () => document.documentElement.dataset.click === 'follow';
/** How the pointer opens a link now: what every hint says. */
const openHint = () => (clickFollows() ? 'click opens' : `${MOD_CLICK} opens`);

/** The page's own controls: only the formatting bar's toggle and its Link button do anything here. */
function wireChrome() {
  const root = document.documentElement;
  const setFmt = (on) => {
    root.dataset.fmt = on ? 'on' : 'off';
    for (const b of document.querySelectorAll('[data-x-set="fmt"] button')) b.setAttribute('aria-pressed', String(b.dataset.value === root.dataset.fmt));
    requestAnimationFrame(() => Links.onLayout());
  };
  pane.querySelector('.ptop').addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    if (b.dataset.view === 'format') setFmt(root.dataset.fmt !== 'on');
    else if (b.dataset.view === 'reading') say('In Reading a plain click follows, as on a page: not shown here');
    else if (b.dataset.view !== 'live') say(`${b.getAttribute('aria-label')}: not in this exploration`);
  });
  pane.querySelector('[data-view="live"]').setAttribute('aria-pressed', 'true');
  const fmt = pane.querySelector('.fmt');
  fmt.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  fmt.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('fmt__link')) linkCommand();
    else say(`${b.getAttribute('aria-label')}: not in this exploration`);
  });
}

// ---- Drawing: the paragraphs from DOC, each link a span over its words.

function draw(sel) {
  prose.replaceChildren(...DOC.map(drawPara));
  drawFile();
  if (sel) select(sel.a, sel.b);
  markHere();
}
function drawPara(par, p) {
  const el = document.createElement('p');
  el.dataset.p = p;
  let at = 0;
  par.links.forEach((l, i) => {
    if (l.start > at) el.append(par.text.slice(at, l.start));
    const span = document.createElement('span');
    span.className = 'lk';
    span.dataset.p = p;
    span.dataset.i = i;
    span.textContent = wordsOf(par, l);
    el.append(Links.render ? Links.render(span, { p, i }) : span);
    at = l.end;
  });
  if (at < par.text.length) el.append(par.text.slice(at));
  if (!par.text.length) el.append(document.createElement('br'));
  markMissing(el);
  return el;
}
/** A note link to a note that isn't made yet: a dotted underline, the wiki's old "red link" without the red. */
function markMissing(root = prose) {
  for (const span of root.querySelectorAll('.lk')) {
    const at = { p: +span.dataset.p, i: +span.dataset.i };
    span.classList.toggle('is-missing', describe(at).kind === 'missing');
  }
}
const spanOf = (at) => prose.querySelector(`.lk[data-p="${at.p}"][data-i="${at.i}"]`);
/** The caret's link wears its own underline, so the card or bar is plainly its. */
function markHere() {
  for (const span of prose.querySelectorAll('.lk')) span.classList.toggle('is-here', same(cur, { p: +span.dataset.p, i: +span.dataset.i }));
  const btn = pane.querySelector('.fmt__link');
  if (btn) btn.setAttribute('aria-pressed', String(!!cur));
}

// ---- Places in the text: { p, o }, a paragraph and an offset in its words. A part of
// the page marked data-skip (2's marks and fields) isn't the paragraph's words.

const notSkipped = (n) => (n.parentElement.closest('[data-skip]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT);
function posOf(node, offset) {
  const pEl = (node.nodeType === 1 ? node : node.parentElement).closest('p[data-p]');
  if (!pEl || !prose.contains(pEl)) {
    const kids = prose.children;
    if (!kids.length) return { p: 0, o: 0 };
    if (offset >= kids.length) return { p: kids.length - 1, o: DOC[kids.length - 1].text.length };
    return { p: offset, o: 0 };
  }
  const p = +pEl.dataset.p;
  const r = document.createRange();
  r.setStart(pEl, 0);
  r.setEnd(node, offset);
  const f = r.cloneContents();
  for (const x of f.querySelectorAll('[data-skip]')) x.remove();
  return { p, o: Math.min(f.textContent.length, DOC[p].text.length) };
}
/** The DOM point for a place; at a link's edge, inside the link if it's the one held open. */
function domAt(p, o) {
  const pEl = prose.children[p];
  const walker = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT, { acceptNode: notSkipped });
  let acc = 0;
  let first = null;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (o >= acc && o <= acc + n.length) {
      const point = { node: n, offset: o - acc };
      const span = n.parentElement.closest('.lk');
      if (Links.opened && span && same(Links.opened, { p: +span.dataset.p, i: +span.dataset.i })) return point;
      first ??= point;
    }
    acc += n.length;
  }
  return first ?? { node: pEl, offset: 0 };
}
function select(a, b = a) {
  const s = getSelection();
  const x = domAt(a.p, a.o);
  const y = domAt(b.p, b.o);
  s.setBaseAndExtent(x.node, x.offset, y.node, y.offset);
}
const before = (a, b) => a.p < b.p || (a.p === b.p && a.o < b.o);
/** The selection in the text, start first; null when it isn't in the text. */
function selRange() {
  const s = getSelection();
  if (!s.rangeCount || !prose.contains(s.anchorNode) || s.anchorNode.parentElement?.closest('[data-field]')) return null;
  const a = posOf(s.anchorNode, s.anchorOffset);
  const b = posOf(s.focusNode, s.focusOffset);
  return before(b, a) ? { a: b, b: a, focus: b } : { a, b, focus: b };
}
const linkAt = (p, o) => {
  const i = DOC[p]?.links.findIndex((l) => l.start <= o && o <= l.end) ?? -1;
  return i < 0 ? null : { p, i };
};
/** Where the caret was last in the text: where Esc from a card or bar goes back to. */
let caret = { p: 0, o: 0 };
let cur = null;
/** The caret's link. A direction may hold a place shut (2, leaving a link by its far side). */
let shutAt = null;

/** Whether the caret's last move was a change's own (typing), not the writer moving it. */
let movedByEdit = false;
function caretMoved() {
  const s = selRange();
  if (!s) return;
  const byEdit = movedByEdit;
  movedByEdit = false;
  caret = s.focus;
  if (shutAt && (shutAt.p !== caret.p || shutAt.o !== caret.o)) shutAt = null;
  const found = shutAt ? null : linkAt(caret.p, caret.o);
  if (!same(found, cur)) {
    cur = found;
    markHere();
    if (cur) sr.textContent = `Link to ${describe(cur).short}. ${KEY('Alt-↩')} opens, ${KEY('Mod-K')} edits, ${KEY('Alt-F10')} its tools.`;
    Links.onCaret(cur, byEdit);
  } else Links.onPlace(cur, byEdit);
  drawWhere();
}
const toCaret = () => {
  prose.focus({ preventScroll: true });
  select(caret);
};

// ---- Changes, each one step of the history: ⌘Z puts back what any of them took.

const past = [];
const future = [];
let lastTyped = 0;
const snapshot = () => JSON.stringify({ DOC, caret, vault: Object.keys(VAULT) });
function checkpoint(typing = false) {
  if (typing && Date.now() - lastTyped < 1500) { lastTyped = Date.now(); return; }
  lastTyped = typing ? Date.now() : 0;
  past.push(snapshot());
  future.length = 0;
}
function restore(json) {
  const s = JSON.parse(json);
  DOC = s.DOC;
  for (const t of Object.keys(VAULT)) if (!s.vault.includes(t)) delete VAULT[t];
  Links.opened = null;
  draw({ a: s.caret });
  toCaret();
}
function undo() {
  if (!past.length) return say('Nothing to undo');
  future.push(snapshot());
  restore(past.pop());
  lastTyped = 0;
  say('Undone');
}
function redo() {
  if (!future.length) return say('Nothing to redo');
  past.push(snapshot());
  restore(future.pop());
  say('Redone');
}

/** Replaces [a, b) with `text` (one line). A link keeps whatever of its words are left. */
function replaceRange(a, b, text) {
  const len = text.length;
  if (a.p === b.p) {
    const par = DOC[a.p];
    const gone = b.o - a.o;
    par.text = par.text.slice(0, a.o) + text + par.text.slice(b.o);
    for (const l of par.links) {
      if (!gone) {
        // Typed at a link's start, the words go before it; at its end, after it; inside, into it.
        if (l.start >= a.o) l.start += len;
        if (l.end > a.o) l.end += len;
        continue;
      }
      // Over a selection: what's typed joins a link the selection began in, or began at its start.
      const start = l.start <= a.o ? l.start : l.start >= b.o ? l.start - gone + len : a.o + len;
      l.end = l.end <= a.o ? l.end : l.end >= b.o ? l.end - gone + len : start <= a.o ? a.o + len : start;
      l.start = start;
    }
    const had = par.links.length;
    par.links = par.links.filter((l) => l.end > l.start);
    return { at: { p: a.p, o: a.o + len }, lost: had - par.links.length };
  }
  const first = DOC[a.p];
  const last = DOC[b.p];
  const shift = a.o + len - b.o;
  const kept = first.links.filter((l) => l.start < a.o).map((l) => ({ ...l, end: Math.min(l.end, a.o) }));
  const after = last.links.filter((l) => l.end > b.o).map((l) => ({ ...l, start: Math.max(l.start, b.o) + shift, end: l.end + shift }));
  const lost = DOC.slice(a.p, b.p + 1).reduce((n, par) => n + par.links.length, 0) - kept.length - after.length;
  DOC.splice(a.p, b.p - a.p + 1, { text: first.text.slice(0, a.o) + text + last.text.slice(b.o), links: [...kept, ...after] });
  return { at: { p: a.p, o: a.o + len }, lost };
}
/** Enter: the paragraph parts at the caret; a link across it goes on in both halves. */
function split(at) {
  const par = DOC[at.p];
  const head = { text: par.text.slice(0, at.o), links: par.links.filter((l) => l.start < at.o).map((l) => ({ ...l, end: Math.min(l.end, at.o) })) };
  const tail = { text: par.text.slice(at.o), links: par.links.filter((l) => l.end > at.o).map((l) => ({ ...l, start: Math.max(l.start, at.o) - at.o, end: l.end - at.o })) };
  DOC.splice(at.p, 1, head, tail);
  return { p: at.p + 1, o: 0 };
}

function edit(a, b, text, typing = false) {
  checkpoint(typing);
  const { at, lost } = replaceRange(a, b, text);
  Links.opened = null;
  movedByEdit = true;
  draw({ a: at });
  if (lost) say(`${lost === 1 ? 'A link' : `${lost} links`} went with ${lost === 1 ? 'its' : 'their'} words · ${KEY('Mod-Z')} puts ${lost === 1 ? 'it' : 'them'} back`);
  Links.onTyping();
}

/** Sets a link's words or where it goes; what's typed there says whether it's a note or the web. */
function setLink(at, { words, target }) {
  const par = DOC[at.p];
  const l = par.links[at.i];
  checkpoint();
  if (words !== undefined && words !== wordsOf(par, l) && words.length) {
    const was = l.kind === 'note' && l.target === null ? wordsOf(par, l) : null;
    replaceRange({ p: at.p, o: l.start }, { p: at.p, o: l.end }, words);
    // [[Rations]] renamed in its words keeps going to Rations: the old words become its target.
    if (was !== null && target === undefined) l.target = was;
  }
  if (target !== undefined) {
    const t = target.trim();
    if (isAddress(t)) { l.kind = 'web'; l.target = asAddress(t); }
    else if (l.kind === 'web' && !t) l.target = '';
    else { l.kind = 'note'; l.target = !t || t === wordsOf(par, l) ? null : t; }
  }
  Links.opened = null;
  draw();
}
function removeLink(at) {
  checkpoint();
  DOC[at.p].links.splice(at.i, 1);
  Links.opened = null;
  cur = null;
  draw();
  toCaret();
  say(`Link taken off; the words stay · ${KEY('Mod-Z')} puts it back`);
}
function makeNote(title) {
  checkpoint();
  VAULT[title] = { ord: 'vi', words: 0, sealed: 'not yet', first: '' };
  draw();
  say(`Made “${title}” in Beneath the Walls, empty`);
}
/** ⌘K, and the formatting bar's Link: the caret's link to edit, or the selected words made one. */
function linkCommand() {
  if (cur) return Links.onEdit(cur);
  const s = selRange() ?? { a: caret, b: caret };
  const par = DOC[s.a.p];
  if (s.a.p !== s.b.p || s.a.o === s.b.o) return say('Select some words to make them a link');
  if (par.links.some((l) => l.start < s.b.o && l.end > s.a.o)) return say('Those words hold a link already');
  checkpoint();
  par.links.push({ kind: 'web', target: '', start: s.a.o, end: s.b.o });
  par.links.sort((x, y) => x.start - y.start);
  const i = par.links.findIndex((l) => l.start === s.a.o);
  cur = { p: s.a.p, i };
  caret = s.b;
  draw({ a: s.b });
  Links.onEdit(cur, { made: true });
}
/** A new link put back, if it was left with nowhere to go. */
function dropIfEmpty(at) {
  const l = linkOf(at);
  if (l && l.kind === 'web' && !l.target) { past.pop(); DOC[at.p].links.splice(at.i, 1); cur = null; draw(); }
}
async function copyLink(at) {
  const par = DOC[at.p];
  const l = par.links[at.i];
  const text = l.kind === 'note' ? `[[${targetOf(par, l)}]]` : l.target;
  try { await navigator.clipboard.writeText(text); say(l.kind === 'note' ? 'Copied the link to the note' : 'Copied the address'); }
  catch { say('Couldn’t reach the clipboard here'); }
}
/** Following: in the app a note opens on the page and an address in the browser. */
function follow(at) {
  const d = describe(at);
  if (d.kind === 'note') say(`Opened ${d.ord} · ${d.title}: in the app the page turns to it`);
  else if (d.kind === 'missing') say(`No note called “${d.title}” yet: make it from the link’s tools`);
  else if (d.kind === 'web') say(`Opened ${d.host} in your browser`);
  else say('This link goes nowhere yet');
}

// ---- The text's own events: typing, the keys, the pointer.

function wireProse() {
  document.addEventListener('selectionchange', () => {
    const s = getSelection();
    if (s.rangeCount && prose.contains(s.anchorNode) && !s.anchorNode.parentElement?.closest('[data-field]')) caretMoved();
  });
  prose.addEventListener('beforeinput', (e) => {
    if (e.target.closest?.('[data-field]')) return; // 2's fields type for themselves
    e.preventDefault();
    const s = selRange();
    if (!s) return;
    const t = e.inputType;
    const data = (e.dataTransfer?.getData('text/plain') ?? e.data ?? '').replace(/\s*\n\s*/g, ' ');
    if (t === 'insertText' || t === 'insertReplacementText' || t === 'insertFromPaste' || t === 'insertFromDrop') {
      if (t === 'insertReplacementText' && e.getTargetRanges().length) {
        const r = e.getTargetRanges()[0];
        return edit(posOf(r.startContainer, r.startOffset), posOf(r.endContainer, r.endOffset), data);
      }
      return edit(s.a, s.b, data, t === 'insertText');
    }
    if (t === 'insertParagraph' || t === 'insertLineBreak') {
      checkpoint();
      replaceRange(s.a, s.b, '');
      const to = split(s.a);
      Links.opened = null;
      draw({ a: to });
      return;
    }
    if (t === 'historyUndo') return undo();
    if (t === 'historyRedo') return redo();
    if (t.startsWith('delete')) {
      let { a, b } = s;
      const r = e.getTargetRanges()[0];
      if (r) { a = posOf(r.startContainer, r.startOffset); b = posOf(r.endContainer, r.endOffset); }
      else if (a.p === b.p && a.o === b.o) {
        if (t.includes('Backward')) a = a.o > 0 ? { p: a.p, o: a.o - 1 } : a.p > 0 ? { p: a.p - 1, o: DOC[a.p - 1].text.length } : a;
        else b = b.o < DOC[b.p].text.length ? { p: b.p, o: b.o + 1 } : b.p < DOC.length - 1 ? { p: b.p + 1, o: 0 } : b;
      }
      if (before(b, a)) [a, b] = [b, a];
      if (a.p === b.p && a.o === b.o) return;
      return edit(a, b, '', true);
    }
  });
  prose.addEventListener('keydown', (e) => {
    if (e.target !== prose) return;
    document.documentElement.classList.toggle('is-mod', mod(e));
    if (Links.onKey(e)) return;
    const k = e.key.toLowerCase();
    if (mod(e) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (mod(e) && k === 'y' && !MAC_KEYS) { e.preventDefault(); redo(); }
    else if (mod(e) && k === 'k') { e.preventDefault(); linkCommand(); }
    else if (e.altKey && e.key === 'Enter') { e.preventDefault(); cur ? follow(cur) : say('No link at the caret'); }
    else if (e.altKey && e.key === 'F10') { e.preventDefault(); cur ? Links.onReach(cur) : say('No link at the caret'); }
    else if (mod(e) && ['b', 'i', 'u'].includes(k)) { e.preventDefault(); say('Formatting: not in this exploration'); }
  });
  addEventListener('keyup', (e) => document.documentElement.classList.toggle('is-mod', mod(e)));
  addEventListener('blur', () => document.documentElement.classList.remove('is-mod'));

  // The pointer: ⌘-click always follows; a plain click follows only when the bar says so,
  // and then ⌥-click puts the caret in the link instead.
  prose.addEventListener('mousedown', (e) => {
    const span = e.target.closest?.('.lk');
    if (!span || e.button !== 0) return;
    const at = { p: +span.dataset.p, i: +span.dataset.i };
    if (mod(e) || (clickFollows() && !e.altKey)) { e.preventDefault(); follow(at); }
  });
  let hoverTimer;
  let leaveTimer;
  let hovered = null;
  prose.addEventListener('mouseover', (e) => {
    if (isTouch()) return;
    const span = e.target.closest?.('.lk');
    if (!span) return;
    clearTimeout(leaveTimer);
    const at = { p: +span.dataset.p, i: +span.dataset.i };
    if (same(at, hovered)) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => { hovered = at; Links.onHover(at, span); }, Links.hoverDelay);
  });
  prose.addEventListener('mouseout', (e) => {
    const span = e.target.closest?.('.lk');
    if (!span || span.contains(e.relatedTarget)) return;
    clearTimeout(hoverTimer);
    leaveSoon();
  });
  // A floating part (data-link-part) keeps the hover while the pointer is over it.
  const leaveSoon = () => {
    clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      if (document.querySelector('[data-link-part]:hover, .lk:hover')) return;
      if (hovered) { hovered = null; Links.onUnhover(); }
    }, 300);
  };
  document.addEventListener('mouseout', (e) => { if (e.target.closest?.('[data-link-part]') && !e.target.closest('[data-link-part]').contains(e.relatedTarget)) leaveSoon(); });
  Links.forgetHover = () => { clearTimeout(hoverTimer); hovered = null; };
}

// ---- The file and the colophon.

let shown = [];
function drawFile() {
  const lines = DOC.flatMap((par, p) => (p ? ['', markdown(par)] : [markdown(par)]));
  let first = 0;
  while (first < lines.length && lines[first] === shown[first]) first++;
  let tail = 0;
  while (tail < lines.length - first && lines[lines.length - 1 - tail] === shown[shown.length - 1 - tail]) tail++;
  if (first < lines.length || lines.length !== shown.length) {
    src.replaceChildren(...lines.map((l, i) => {
      const ln = document.createElement('span');
      ln.className = 'ln';
      if (shown.length && i >= first && i < lines.length - tail) ln.classList.add('is-changed');
      // Each line ends in its newline, so the file copies as it's saved.
      ln.textContent = `${l}\n`;
      return ln;
    }));
    shown = lines;
  }
  drawWhere();
}
function drawWhere() {
  const all = DOC.reduce((n, par) => n + par.links.length, 0);
  const words = DOC.reduce((n, par) => n + par.text.split(/\s+/).filter(Boolean).length, 0);
  const kinds = { note: 'to a note', missing: 'to a note not made yet', web: 'to the web', empty: 'with no address yet' };
  let n = 0;
  if (cur) for (let p = 0; p < cur.p; p++) n += DOC[p].links.length;
  whereEl.textContent = cur && linkOf(cur)
    ? `Link ${n + cur.i + 1} of ${all} · ${kinds[describe(cur).kind]}`
    : `Notes for iv · ${words} words · ${all} links`;
  // The caret's line in the file, once there's a caret in the text.
  const inText = !!cur || prose.contains(document.activeElement);
  src.querySelectorAll('.ln').forEach((ln, i) => ln.classList.toggle('is-here', inText && i === caret.p * 2));
}
let saidTimer;
/** Says it in the colophon a while; `stay` keeps it there until something else is said. */
function say(words, stay = false) {
  said.textContent = words;
  clearTimeout(saidTimer);
  if (!stay) saidTimer = setTimeout(() => { said.textContent = ''; }, 6000);
}

// ---- What the directions build with.

/** An element, its class and text; never markup. */
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
/** An icon button: its name for a screen reader, its tooltip with the key; `word` shown beside the icon where asked. */
function iconButton(name, label, key, run, { word } = {}) {
  const b = el('button', 'icon-button');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.dataset.tip = key ? `${label}  ${key}` : label;
  b.insertAdjacentHTML('afterbegin', icon(name));
  if (word) { b.classList.add('icon-button--word'); b.append(el('span', 'icon-button__word', word)); }
  b.addEventListener('mousedown', (e) => e.preventDefault());
  b.addEventListener('click', run);
  return b;
}
/** Arrows along a row of buttons (one tab stop), Esc back to the caret. */
function roving(row) {
  row.addEventListener('keydown', (e) => {
    const bs = [...row.querySelectorAll('button')];
    const i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: bs.length - 1 }[e.key];
    if (to !== undefined) { e.preventDefault(); bs[(to + bs.length) % bs.length].focus(); }
  });
  row.addEventListener('focusin', () => row.querySelectorAll('button').forEach((b) => { b.tabIndex = b === document.activeElement ? 0 : -1; }));
}
/** The link's box on the sheet: the line the caret is on, or its first. */
function linkBox(at) {
  const span = spanOf(at);
  if (!span) return null;
  const rects = [...span.getClientRects()];
  let r = rects[0];
  const s = getSelection();
  if (s.rangeCount && span.contains(s.focusNode)) {
    const c = s.getRangeAt(0).getBoundingClientRect();
    r = rects.find((x) => c.top >= x.top - 2 && c.top <= x.bottom) ?? r;
  }
  const base = sheet.getBoundingClientRect();
  return { left: r.left - base.left, right: r.right - base.left, top: r.top - base.top, bottom: r.bottom - base.top, viewTop: r.top, viewBottom: r.bottom };
}
/** Lays a floating part under (or, with no room, over) a box, kept inside the sheet. */
function placeBy(part, box, side = 'below') {
  const gap = 4;
  const w = part.offsetWidth;
  const h = part.offsetHeight;
  const room = page.getBoundingClientRect();
  let below = side === 'below';
  if (below && box.viewBottom + gap + h > room.bottom && box.viewTop - gap - h > room.top) below = false;
  if (!below && box.viewTop - gap - h < room.top) below = true;
  const pad = 8;
  part.style.left = `${Math.max(pad, Math.min(box.left, sheet.clientWidth - w - pad))}px`;
  part.style.top = `${below ? box.bottom + gap : box.top - gap - h}px`;
  part.dataset.side = below ? 'below' : 'above';
}

/** The shared notes' keys and the click question, for each page's notes. */
const SHARED_NOTES = () => `
  <h2>Keys, in all three</h2>
  <ul>
    <li>arrows into a link: its tools come with the caret, and a screen reader hears where it goes</li>
    <li><kbd>${KEY('Alt-↩')}</kbd> opens the caret's link; <kbd>${MOD_CLICK}</kbd> opens any link</li>
    <li><kbd>${KEY('Mod-K')}</kbd> edits the caret's link, or makes the selected words one (the formatting bar's Link too)</li>
    <li><kbd>${KEY('Alt-F10')}</kbd> from the text to the link's tools; <kbd>Esc</kbd> back</li>
    <li><kbd>${KEY('Mod-Z')}</kbd> puts back any change, a link taken off or its words typed over</li>
  </ul>
  <h2>Where it goes</h2>
  <p>Type an address and it's a web link, <code>[words](address)</code>; type a note's name and it's a <code>[[wiki link]]</code>, its name finished for you from the vault (<kbd>Tab</kbd> or <kbd>→</kbd> takes it). A note not made yet has a dotted underline, and its tools offer to make it.</p>`;
