// Foldables and tablets (tablet-*.html, backlog #46): Eien's phone app on five
// screens, drawn at their real size and scaled to fit. A direction (mountTablet's
// `dir`) arranges the app on each screen; the device, the vault, the parts every
// direction shares (the contents, the index, the page, the bar, the page's tools
// in each layout, the ⋯ menu, Settings) and the taps are here. Everything drawn
// is the page's own constants, escaped; nothing typed goes into markup.

Object.assign(ICONS, {
  swap: '<path d="M3 5.5h9.5M10 3l2.5 2.5L10 8"/><path d="M13 10.5H3.5M6 8l-2.5 2.5L6 13"/>',
  side: '<path d="M2.5 3h11v10h-11z"/><path d="M8 3v10"/><path d="M10 6.5v3M8.5 8h3"/>',
  copy: '<path d="M5.5 5.5h8v8h-8z"/><path d="M10.5 5.5v-3h-8v8h3"/>',
  cards: '<path d="M2.5 3h4.5v4.5H2.5zM9 3h4.5v4.5H9zM2.5 8.5h4.5V13H2.5zM9 8.5h4.5V13H9z"/>',
  panes1: '<path d="M2 3h12v10H2z"/>',
  export: '<path d="M8 2.5v7.5M5 5.5l3-3 3 3"/><path d="M3 9.5v4h10v-4"/>',
  seal: '<path d="M3 3h10v10H3z"/>',
  open: '<path d="M3 3h10v10H3z"/><path d="M6 8h4"/>',
  alone: '<path d="M2.5 3h11v10h-11z"/><path d="M5 6h6M5 8.5h6M5 11h4"/>',
});

// ── The vault: a book and its notes, and a few folders round it ──
const NOTES = {
  i: { folder: 'walls', ord: 'i', title: 'The Late Watch', rest: 2815, sealed: 'Sep 2', tags: ['fic/aot'],
    paras: ['He takes the late watch, every night of the week, and nobody asks why.', 'The wall is colder at night than anyone tells the recruits.'] },
  ii: { folder: 'walls', ord: 'ii', title: 'Rations', rest: 2181, sealed: 'Sep 9', tags: ['fic/aot'],
    paras: ['Half a loaf, a strip of dried meat, and a promise from the quartermaster.', 'The promise is the part that runs out first.'] },
  iii: { folder: 'walls', ord: 'iii', title: 'Below the Gate', rest: 3389, sealed: 'yesterday', tags: ['fic/aot', 'draft'],
    paras: ['The water came up through the stones first, before anyone heard it.', 'By the time the bell rang, the lower stair was gone.'] },
  iv: { folder: 'walls', ord: 'iv', title: 'What the Recruits Say', rest: 2999, sealed: '2h ago', tags: ['fic/aot', 'draft'],
    paras: ['They have a name for him in the barracks, and none of them will say it where he can hear. He does not ask.',
      'Instead he takes the late watch, every night of the week, and lets them talk around the brazier as if he were part of the stone.',
      'Erwin finds him there an hour before dawn, and says nothing either. The two of them stand at the parapet until the sky goes from black to the grey of old iron.',
      '“They’re afraid of you,” Erwin says at last.', '“Good,” he says. “Afraid keeps.”',
      'Below them the recruits sleep in rows, boots by their heads, as he taught them. Somebody is talking in his sleep about bread.'] },
  v: { folder: 'walls', ord: 'v', title: 'The Long Way Round', rest: 1898, sealed: 'never', tags: ['fic/aot', 'draft'],
    paras: ['Nobody had walked the outer road in years.', 'The grass had come up between the stones as if it had been waiting.'] },
  erwin: { folder: 'walls', ord: '·', title: 'Erwin', rest: 0, sealed: 'Sep 30', tags: ['character'],
    paras: ['Commander. Speaks last in any room, and never twice.', 'Knows the recruits’ name for Levi. Has never used it.',
      'Chapter iv: he comes to the wall before dawn. What does he want? To be told no.', 'Keeps his left hand still when he lies. Levi has noticed; nobody else has.'] },
  pier: { folder: 'short', ord: '', title: 'The Pier at Low Tide', rest: 1204, sealed: 'Aug 14', tags: ['draft'],
    paras: ['At low tide the pier stands on its legs like a heron, and the town pretends not to see it.'] },
  letters: { folder: 'short', ord: '', title: 'Letters Not Sent', rest: 860, sealed: 'Jul 3', tags: [],
    paras: ['The first one began “Dear”, and stopped there for a week.'] },
  rereading: { folder: 'essays', ord: '', title: 'On Rereading', rest: 1730, sealed: 'Oct 1', tags: ['essay'],
    paras: ['A book read twice is two books, and the second one is mostly about you.'] },
  middle: { folder: 'essays', ord: '', title: 'The Long Middle', rest: 2210, sealed: 'Oct 12', tags: ['essay', 'draft'],
    paras: ['Every draft has a middle where it forgets why it started.'] },
  oct: { folder: 'journal', ord: '', title: 'October', rest: 3120, sealed: 'today', tags: [],
    paras: ['Wrote the wall scene on the train, folded, one thumb. Finished it at home on the big screen.'] },
};
const FOLDERS = [
  { id: 'fic', name: 'Fic', d: 0, count: 8, parent: true },
  { id: 'walls', name: 'Beneath the Walls', d: 1, book: true },
  { id: 'short', name: 'Short pieces', d: 1 },
  { id: 'essays', name: 'Essays', d: 0 },
  { id: 'journal', name: 'Journal', d: 0 },
];
const TAGS = [['fic/aot', 5], ['draft', 5], ['character', 1], ['essay', 2]];
const folderOf = (id) => FOLDERS.find((f) => f.id === id);
const notesIn = (folder) => Object.keys(NOTES).filter((id) => NOTES[id].folder === folder);
const countOf = (f) => f.count ?? notesIn(f.id).length;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wordsOf = (id) => NOTES[id].rest + NOTES[id].paras.join(' ').split(/\s+/).filter(Boolean).length;
const words = (id) => wordsOf(id).toLocaleString('en');
const crumbOf = (id) => { const f = folderOf(NOTES[id].folder); const up = FOLDERS.find((p) => p.parent && f.d === 1); return [up && up.name, f.name, (NOTES[id].ord && NOTES[id].ord !== '·' ? NOTES[id].ord : NOTES[id].title)].filter(Boolean).join(' / '); };

// ── The screens: each in CSS pixels, a phone's points or dp ──
const DEVICES = {
  phone: { w: 390, h: 844, kind: 'phone', name: 'a phone' },
  folded: { w: 360, h: 800, kind: 'phone', name: 'a foldable, folded: its cover screen' },
  open: { w: 720, h: 820, kind: 'open', hinge: 360, name: 'a foldable, open: the fold down its middle' },
  upright: { w: 820, h: 1180, kind: 'tablet', name: 'a tablet, upright' },
  sideways: { w: 1180, h: 820, kind: 'tablet', name: 'a tablet, sideways' },
};
/** Narrower than any desktop window: a phone's, one pane at a time (src/ui/phone/phone-stack.ts, NARROW). */
const PHONE_MAX = 600;

const S = { note: 'iv', other: 'erwin', folder: 'walls', shown: 'page', view: 'live', menu: null, settings: null, said: '', inert: {} };
let DIR = null;
let device, screen, app, fitBox, canvas, saidEl;
const root = document.documentElement;

function context() {
  const dev = DEVICES[root.dataset.device] ?? DEVICES.phone;
  const ctx = { dev, W: dev.w, H: dev.h, narrow: dev.w < PHONE_MAX, layout: root.dataset.layout, hinge: dev.hinge ?? null };
  return Object.assign(ctx, parts(ctx));
}

/** The parts every direction draws with. */
function parts(ctx) {
  const p = {
    btn: (name, label, attrs = '', cls = '') => `<button class="icon-button ${cls}" data-icon="${name}" aria-label="${esc(label)}" ${attrs}></button>`,
    views: () => `<span class="tools" role="group" aria-label="View">${[['live', 'Live'], ['source', 'Source'], ['reading', 'Reading']].map(([v, w]) => p.btn(v, w, `aria-pressed="${S.view === v}" data-act="view" data-value="${v}"`)).join('')}</span>`,
    seal: () => `<button class="icon-button seal-control" aria-label="Seal" data-act="say" data-say="Sealed: ${esc(NOTES[S.note].title)}, kept for good"><span class="seal">永</span></button>`,
    more: (extra = '') => p.btn('more', 'More', `data-act="more" aria-haspopup="menu" ${extra}`),
    /** The page's tools for a touch screen: the views, focus, the seal, the ⋯ (the phone's set). */
    phoneTools: () => `${p.views()}<span class="tools-rule" aria-hidden="true"></span><span class="tools">${p.btn('focus', 'Focus mode', 'data-act="say" data-say="Focus mode: every paragraph but the caret’s fades back"')}${p.seal()}${p.more()}</span>`,
    /** With room, the desktop's set: the views, then the tools; spare ones go behind ⋯ short of room. */
    deskTools: () => `${p.views()}<span class="tools">${p.btn('compare', 'Compare', 'data-act="say" data-say="Compare: against its last seal"')}${p.btn('versions', 'Versions', 'data-act="say" data-say="Versions: its seals open at the screen’s right edge"')}${p.btn('copy', 'Copy as HTML', 'data-act="say" data-say="Copied as HTML"', 'tool--spare')}${p.btn('cards', 'Outline cards', 'data-act="say" data-say="Outline cards: the book’s cards take the page"', 'tool--spare')}${p.btn('focus', 'Focus mode', 'data-act="say" data-say="Focus mode: every paragraph but the caret’s fades back"')}${p.more()}</span>`,
    /**
     * Where the page's tools go, by layout. `phone`: A's in the bar, B's slip at the page's foot, C's
     * rail under it (the phone bottoms). `desk`: A's band, B's slip at the top right, C's strip of desk.
     */
    place: (kind, id) => {
      const L = ctx.layout;
      if (kind === 'phone') {
        if (L === 'band') return { bar: `<span class="tools">${p.views()}${p.more()}</span>` };
        if (L === 'slip') return { float: `<div class="slip slip--foot" role="toolbar" aria-label="Page tools">${p.views()}<span class="tools-rule" aria-hidden="true"></span>${p.more()}</div>` };
        return { foot: `<div class="rail" role="toolbar" aria-label="Page tools">${p.views()}${p.btn('focus', 'Focus mode', 'data-act="say" data-say="Focus mode: every paragraph but the caret’s fades back"')}${p.seal()}${p.more()}</div>` };
      }
      if (L === 'band') return { top: `<div class="pband" role="toolbar" aria-label="Page tools">${p.deskTools()}</div>` };
      if (L === 'slip') return { float: `<div class="slip slip--top" role="toolbar" aria-label="Page tools">${p.views()}<span class="tools-rule" aria-hidden="true"></span>${p.btn('focus', 'Focus mode', 'data-act="say" data-say="Focus mode: every paragraph but the caret’s fades back"')}${p.more()}</div>` };
      return { top: `<div class="runhead" role="toolbar" aria-label="Page tools">${p.views()}<span class="crumb">${esc(crumbOf(id))}</span>${p.btn('focus', 'Focus mode', 'data-act="say" data-say="Focus mode: every paragraph but the caret’s fades back"')}${p.more()}</div>` };
    },
    /** The contents: the vault, LIBRARY, FOLDERS (with a book's notes under it, `notes`), TAGS, the foot. */
    tree: ({ notes = false, foot = '', head = true, headExtra = '', chosen = S.folder } = {}) => {
      const fRow = (f) => {
        const open = notes && f.id === S.folder;
        const twisty = f.parent || notes ? `<span class="twisty">${icon(f.parent || open ? 'down' : 'right')}</span>` : '';
        const isChosen = !notes && f.id === chosen;
        return `<button class="trow${isChosen ? ' is-chosen' : ''}" style="--d:${f.d}" data-act="folder" data-id="${f.id}"${isChosen ? ' aria-current="true"' : ''}>${twisty}<span class="trow__name">${esc(f.name)}</span>${f.book ? '<span class="book-mark">Book</span>' : ''}<span class="count">${countOf(f)}</span></button>${open ? notesIn(f.id).map((id) => `<button class="trow${id === S.note ? ' is-chosen' : ''}${id === S.besideNote ? ' is-beside' : ''}" style="--d:${f.d + 1}" data-act="open-note" data-id="${id}" data-long="1"${id === S.note ? ' aria-current="true"' : ''}><span class="ord">${esc(NOTES[id].ord)}</span><span class="trow__name">${esc(NOTES[id].title)}</span><span class="count">${words(id)}</span></button>`).join('') : ''}`;
      };
      return `<nav class="tree" aria-label="Contents">
        ${head ? `<div class="tree__head"><span class="seal" aria-hidden="true">永</span><span class="tree__vault">Vault</span>${p.btn('search', 'Search', 'data-act="say" data-say="Search: every note in the vault"')}${headExtra}</div>` : ''}
        <div class="tree__scroll">
          <div class="sec label">Library</div>
          <button class="trow" data-act="folder" data-id="journal"><span class="trow__name">All Notes</span><span class="count">40</span></button>
          <button class="trow" data-act="folder" data-id="essays"><span class="trow__name">Pinned</span><span class="count">3</span></button>
          <div class="sec label">Folders</div>
          ${FOLDERS.map(fRow).join('')}
          <div class="sec label">Tags</div>
          ${TAGS.map(([t, n]) => `<button class="trow" data-act="say" data-say="#${esc(t)}: its notes"><span class="tag-hash">#</span><span class="trow__name">${esc(t)}</span><span class="count">${n}</span></button>`).join('')}
        </div>
        ${foot}
      </nav>`;
    },
    /** The sidebar's foot: the vault's count and sync, then day or night, `extra`, settings. */
    foot: (extra = '') => `<div class="foot"><span class="label">40 notes</span><span class="sync" data-icon="sync" role="img" aria-label="Synced"></span>${p.btn(root.dataset.theme === 'dark' ? 'moon' : 'sun', 'Day or night', 'data-act="scheme"')}${extra}${p.btn('settings', 'Settings', 'data-act="settings"')}</div>`,
    /** The index: a folder's notes, its search band, its head. */
    index: ({ band = true, head = '' } = {}) => {
      const f = folderOf(S.folder);
      const ids = notesIn(S.folder);
      const total = ids.reduce((sum, id) => sum + wordsOf(id), 0).toLocaleString('en');
      return `<section class="index" aria-label="${esc(f.name)}: its notes">
        ${band ? `<div class="index__band"><span class="search">${icon('search')}<span>Search</span></span></div>` : ''}
        <header class="index__head"><span class="index__title">${esc(f.name)}</span><span class="tools">${head}${p.btn('plus', 'New note', 'data-act="say" data-say="New note: in this folder, its title selected"')}</span><span class="label index__meta">${ids.length} notes · ${total} words${f.book ? ' · book' : ''}</span></header>
        <div class="rows">${ids.map((id) => `<button class="row${id === S.note && S.shown === 'page' ? ' is-chosen' : ''}${id === S.besideNote ? ' is-beside' : ''}" data-act="open-note" data-id="${id}" data-long="1"${id === S.note ? ' aria-current="true"' : ''}><span class="row__ord">${esc(NOTES[id].ord)}</span><span class="row__title">${esc(NOTES[id].title)}</span><span class="count">${words(id)}</span><span class="row__preview">${esc(NOTES[id].paras[0])}</span></button>`).join('')}</div>
      </section>`;
    },
    /** A note's sheet: the running head (A's crumb and tags, B's crumb and slips), the title, the words. */
    sheet: (id, { crumb = ctx.layout !== 'runhead' || ctx.narrow, extra = '' } = {}) => {
      const n = NOTES[id];
      const tags = n.tags.map((t) => `<span>#${esc(t)}</span>`).join('');
      return `<article class="sheet">${extra}<div class="sheet__head">${crumb ? `<span class="crumb">${esc(crumbOf(id))}</span>` : '<span></span>'}${ctx.layout === 'band' ? `<span class="tagset">${tags}</span>` : ''}</div>
        <h1 class="title">${esc(n.title)}</h1>${ctx.layout === 'slip' && tags ? `<div class="slips">${tags}</div>` : ''}
        <div class="prose" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="${esc(n.title)}: its words">${n.paras.map((t) => `<p>${esc(t)}</p>`).join('')}</div></article>`;
    },
    /** The colophon: words, today's, the last seal; C's tags as pills. */
    colophon: (id) => `<footer class="colophon"><span>${words(id)} words</span><span class="opt"><span class="dot" aria-hidden="true">·</span><span>today 412</span></span><span class="dot" aria-hidden="true">·</span><span><span class="sealmark" aria-hidden="true">▪</span> sealed ${esc(NOTES[id].sealed)}</span>${ctx.layout === 'runhead' ? `<span class="opt">${NOTES[id].tags.map((t) => `<span class="pill">#${esc(t)}</span>`).join(' ')}</span>` : ''}</footer>`,
    /** The bar a phone goes back by: back (naming where), then what's given. */
    bar: (back, rest = '') => `<nav class="bar" aria-label="Back">${back ? `<button class="back" data-act="back">${icon('back')}<span>${esc(back)}</span></button>` : ''}${rest}</nav>`,
    /** The note you came from, a tap away. */
    otherSlip: () => (S.other && S.other !== S.note ? `<button class="other" data-act="other" aria-label="Back to ${esc(NOTES[S.other].title)}">${icon('swap')}<span>${esc(NOTES[S.other].title)}</span></button>` : ''),
    /**
     * A page: its tools where the layout puts them (`kind`: phone or desk), the sheet in its frame
     * (sheet on the blotter, or full paper), and the colophon on a desk page. `lead` goes first in
     * the tools (a shut pane's ›). A's phone tools are the bar's: the caller puts them there.
     */
    page: (id, { frame = 'sheet', kind = 'desk', lead = '', cls = '' } = {}) => {
      const t = p.place(kind, id);
      const top = t.top ? t.top.replace(/^(<div[^>]*>)/, `$1${lead}`) : '';
      const float = t.float ? t.float.replace(/^(<div[^>]*>)/, `$1${lead}`) : '';
      return `<section class="page ${cls}" data-frame="${frame}" aria-label="${esc(NOTES[id].title)}">${top || '<span></span>'}<div class="scroll" data-keep="page">${p.sheet(id, { crumb: !(t.top && ctx.layout === 'runhead') })}</div>${float}${t.foot ?? (kind === 'desk' ? p.colophon(id) : '')}</section>`;
    },
  };
  return p;
}

/** The phone, as built: one pane at a time, tree → list → page, a bar back. `foot` joins the tree's foot. */
function phoneStack(ctx, { frame = 'full', foot = '' } = {}) {
  const move = (cls) => `class="stack ${cls}"`;
  if (S.shown === 'tree') return `<div ${move('from-left')}>${ctx.tree({ foot: ctx.foot(foot) })}</div>`;
  if (S.shown === 'list') return `<div ${move('from-right')}>${ctx.bar('Library')}${ctx.index()}</div>`;
  const t = ctx.place('phone', S.note);
  return `<div ${move('from-right')}>${ctx.bar(folderOf(S.folder).name, `<span class="spacer"></span>${ctx.otherSlip()}${t.bar ?? ''}`)}${ctx.page(S.note, { frame, kind: 'phone' })}</div>`;
}

// ── What floats: the ⋯ menu and Settings ──
function menuHtml(ctx) {
  const m = S.menu;
  if (!m) return '';
  const items = m.items.map((it) => (it.rule ? '<div class="menu__rule" role="separator"></div>'
    : `<button class="menu__item${it.danger ? ' is-danger' : ''}" role="${it.role ?? 'menuitem'}"${it.role ? ` aria-checked="${!!it.dot}"` : ''} data-act="${it.act}"${it.value ? ` data-value="${esc(it.value)}"` : ''}${it.say ? ` data-say="${esc(it.say)}"` : ''}${it.disabled ? ' disabled' : ''}>${icon(it.icon)}<span>${esc(it.word)}</span>${it.dot ? '<span class="menu__dot" aria-hidden="true"></span>' : '<span></span>'}${it.why ? `<span class="why">${esc(it.why)}</span>` : ''}</button>`)).join('');
  return `<div class="scrim" data-act="close" style="background:none"></div><div class="menu" role="menu" aria-label="${esc(m.head)}" style="${m.pos}">${m.head ? `<div class="menu__head">${esc(m.head)}</div>` : ''}${items}</div>`;
}
/** The page's ⋯: what the menu bar does on the desktop, and the direction's own. */
function pageMenu() {
  const t = NOTES[S.note].title;
  return { head: t, items: [
    { icon: 'seal', word: 'Seal', act: 'say', say: `Sealed: ${t}` },
    { icon: 'compare', word: 'Compare', act: 'say', say: 'Compare: against its last seal' },
    { icon: 'versions', word: 'Versions', act: 'say', say: 'Versions: its seals' },
    { icon: 'cards', word: 'Outline cards', act: 'say', say: 'Outline cards: the book’s cards take the page' },
    { icon: 'copy', word: 'Copy as HTML', act: 'say', say: `Copied ${t} as HTML` },
    { icon: 'export', word: 'Export…', act: 'say', say: 'Export: HTML, EPUB or Word' },
    ...(DIR.menuItems ? [{ rule: true }, ...DIR.menuItems(context())] : []),
    { rule: true },
    { icon: 'settings', word: 'Settings', act: 'settings' },
  ] };
}

/** A note's menu, on a long press (a finger scrolls a list and never lifts a row). `first` leads it. */
function noteMenu(id, first = [{ icon: 'open', word: 'Open', act: 'open-note', value: id }]) {
  const n = NOTES[id];
  return { head: n.title, items: [
    ...first,
    { icon: 'rename', word: 'Rename', act: 'say', say: `Rename ${n.title}: its name becomes a field, where it stands` },
    { icon: 'up', word: 'Move up', act: 'say', say: `${n.title}: one place up` },
    { icon: 'down', word: 'Move down', act: 'say', say: `${n.title}: one place down` },
    { icon: 'move', word: 'Move to…', act: 'say', say: 'Move to: the folders' },
    { rule: true },
    { icon: 'trash', word: 'Move to Trash', act: 'say', say: `${n.title} is in the trash, and Undo puts it back`, danger: true },
  ] };
}

const CATEGORIES = [
  { name: 'Look', icon: 'type', tabs: ['Appearance', 'Type', 'Page'] },
  { name: 'Themes', icon: 'palette', tabs: ['Gallery', 'Custom'] },
  { name: 'Writing', icon: 'live', tabs: ['Lists', 'Editor'] },
  { name: 'This vault', icon: 'folder', tabs: ['Writing '] },
];
/** Each tab's settings; the direction's option joins its own tab. */
function tabSettings(tab, ctx) {
  const opt = DIR.option;
  const list = {
    Appearance: [
      { key: 'scheme', label: 'Day or night', about: 'Night is inkstone: the same warm hues, darkened.', choices: { light: 'Day', dark: 'Night' }, value: root.dataset.theme },
      { key: 'layout', label: 'Layout', about: 'Where the page’s tools appear. Band: in the bar above the page. Slip: floating over the page. Running head: a rail at the page’s foot, on a phone.', choices: { band: 'Band', slip: 'Slip', runhead: 'Running head' }, value: root.dataset.layout },
    ],
    Lists: [
      { key: 'arranging', label: 'Arranging', about: 'A finger scrolls a list and never lifts a row: a note moves by its menu (a long press).', choices: { anytime: 'Drag anytime', arrange: 'Arrange mode' }, value: S.inert.arranging ?? 'anytime' },
      { key: 'numerals', label: 'Chapter numbers', about: 'In a book’s list and its breadcrumb.', choices: { roman: 'i ii iii', arabic: '1 2 3' }, value: S.inert.numerals ?? 'roman' },
    ],
  }[tab] ?? [];
  if (opt.tab === tab) list.splice(opt.at ?? list.length, 0, { key: 'opt', label: opt.label, about: opt.about, choices: opt.choices, value: S.opt, now: opt.now?.(ctx) });
  return list;
}
function settingsHtml(ctx) {
  if (!S.settings) return '';
  const tab = S.settings;
  const cat = CATEGORIES.find((c) => c.tabs.includes(tab));
  const nav = CATEGORIES.map((c) => `<div class="settings__cat">${icon(c.icon)}${esc(c.name)}</div>${c.tabs.map((t) => `<button class="tab" data-act="tab" data-value="${esc(t)}" aria-current="${t === tab}">${esc(t.trim())}</button>`).join('')}`).join('');
  const items = tabSettings(tab, ctx);
  const body = items.length ? items.map((s) => `<div class="setting"${s.key === 'opt' ? ' id="the-option"' : ''}><p class="setting__label">${esc(s.label)}</p><p class="setting__about">${esc(s.about)}</p><div class="seg" role="group" aria-label="${esc(s.label)}">${Object.entries(s.choices).map(([v, w]) => `<button data-act="set" data-key="${s.key}" data-value="${esc(v)}" aria-pressed="${v === s.value}">${esc(w)}</button>`).join('')}</div>${s.now ? `<p class="setting__now">${esc(s.now)}</p>` : ''}</div>`).join('')
    : `<p class="setting__about">${esc(tab.trim())}’s settings, as built.</p>`;
  return `<div class="scrim" data-act="close-settings"></div><section class="settings" role="dialog" aria-modal="true" aria-label="Settings"${ctx.narrow ? ' data-full' : ''}>
    <div class="settings__head"><p class="label settings__crumbs">Settings<span class="sl">/</span>${esc(cat.name)}<span class="sl">/</span><b>${esc(tab.trim())}</b></p>${parts(ctx).btn('close', 'Close settings', 'data-act="close-settings"')}</div>
    <nav class="settings__nav" aria-label="Settings">${nav}</nav>
    <div class="settings__body">${body}</div></section>`;
}

// ── Drawing and fitting ──
function render(move = '') {
  const ctx = context();
  device.style.setProperty('--dev-w', `${ctx.W}px`);
  device.style.setProperty('--dev-h', `${ctx.H}px`);
  device.dataset.kind = ctx.dev.kind;
  screen.toggleAttribute('data-narrow', ctx.narrow);
  screen.setAttribute('aria-label', `Eien on ${ctx.dev.name}, ${ctx.W} by ${ctx.H}`);
  const scrollTops = [...app.querySelectorAll('[data-keep]')].map((el) => [el.dataset.keep, el.scrollTop]);
  app.innerHTML = DIR.draw(ctx) + menuHtml(ctx) + settingsHtml(ctx) + (ctx.hinge ? `<div class="hinge" style="--hinge-x:${ctx.hinge}px" aria-hidden="true"></div>` : '');
  for (const [k, top] of scrollTops) { const el = app.querySelector(`[data-keep="${k}"]`); if (el) el.scrollTop = top; }
  drawIcons(app);
  if (move) {
    screen.classList.remove('is-moving');
    void screen.offsetWidth;
    screen.classList.add('is-moving');
  }
  const first = app.querySelector('.menu .menu__item, .settings #the-option button, .settings .tab[aria-current="true"]');
  if (first && (S.menu || S.settings) && S.focusFloat) { first.focus({ preventScroll: true }); S.focusFloat = false; }
  if (S.settings) app.querySelector('#the-option')?.scrollIntoView({ block: 'nearest' });
  saidEl.textContent = S.said;
  fit();
}
function fit() {
  const ctx = context();
  const w = ctx.W + 2 * (ctx.dev.kind === 'tablet' ? 16 : 10);
  const h = ctx.H + 2 * (ctx.dev.kind === 'tablet' ? 16 : 10);
  const room = canvas.getBoundingClientRect();
  const scale = Math.min(1, (room.width - 32) / w, (room.height - 40 - saidEl.offsetHeight) / h);
  device.style.transform = `scale(${scale})`;
  fitBox.style.width = `${w * scale}px`;
  fitBox.style.height = `${h * scale}px`;
  S.scale = scale;
}
function say(text) {
  S.said = text;
  saidEl.textContent = text;
}

/** A menu by `el`, placed in the screen's own pixels (the device is scaled). */
function openMenu(m, el) {
  const s = screen.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const k = S.scale || 1;
  const x = (r.left - s.left) / k;
  const y = (r.bottom - s.top) / k;
  const ctx = context();
  const right = x > ctx.W / 2;
  const below = y < ctx.H * 0.55;
  const top = below ? y - 28 + 4 : null; // the screen's status bar is the app's first row
  const bottom = below ? null : ctx.H - (r.top - s.top) / k + 4;
  m.pos = `${right ? `right:${Math.max(8, ctx.W - (r.right - s.left) / k)}px` : `left:${Math.max(8, x)}px`};${below ? `top:${top}px` : `bottom:${bottom}px`}`;
  S.menu = m;
  S.focusFloat = true;
  render();
}

// ── Taps ──
function act(name, el) {
  const ctx = context();
  if (DIR.act && DIR.act(name, el, ctx)) return;
  const v = el.dataset.value;
  switch (name) {
    case 'open-note': openNote(el.dataset.id ?? el.dataset.value); break;
    case 'folder': if (!folderOf(el.dataset.id)) break; S.folder = el.dataset.id; if (S.folder === 'fic') S.folder = 'walls'; S.shown = 'list'; say(`${folderOf(S.folder).name}: its notes`); render('right'); break;
    case 'back': back(); break;
    case 'other': { const was = S.note; S.note = S.other; S.other = was; say(`Back to ${NOTES[S.note].title}, where you left it`); render('left'); break; }
    case 'view': S.view = v; say(`${v[0].toUpperCase()}${v.slice(1)}: the view`); render(); break;
    case 'more': openMenu(pageMenu(), el); break;
    case 'say': S.menu = null; say(el.dataset.say); render(); break;
    case 'scheme': setRoot('theme', root.dataset.theme === 'dark' ? 'light' : 'dark'); break;
    case 'settings': S.menu = null; S.settings = DIR.option.tab; S.focusFloat = true; say(`Settings: ${DIR.option.label} is in ${DIR.option.where}`); render(); break;
    case 'tab': S.settings = v; render(); break;
    case 'close-settings': S.settings = null; render(); break;
    case 'close': S.menu = null; render(); break;
    case 'set': {
      const key = el.dataset.key;
      if (key === 'scheme') setRoot('theme', v);
      else if (key === 'layout') setRoot('layout', v);
      else if (key === 'opt') { S.opt = v; DIR.onOption?.(v, context()); render('in'); }
      else { S.inert[key] = v; render(); }
      break;
    }
    case 'opt': S.menu = null; S.opt = v; DIR.onOption?.(v, context()); render('in'); break;
    default: break;
  }
}
function openNote(id) {
  if (!Object.hasOwn(NOTES, id)) return; // only the vault's own notes: an id read from the page is checked, never drawn
  if (id !== S.note) { S.other = S.note; S.note = id; }
  S.folder = NOTES[id].folder;
  S.shown = 'page';
  S.menu = null;
  say(`${NOTES[id].title}: open`);
  render('right');
}
function back() {
  S.shown = S.shown === 'page' ? 'list' : 'tree';
  say(S.shown === 'list' ? `Back to ${folderOf(S.folder).name}` : 'Back to the vault');
  render('left');
}
/** A choice made in Settings or the bar: <html>'s attribute, and the bar's buttons pressed to match. */
function setRoot(attr, value) {
  root.dataset[attr] = value;
  for (const group of document.querySelectorAll(`[data-x-set="${attr}"]`)) {
    for (const b of group.querySelectorAll('button[data-value]')) b.setAttribute('aria-pressed', String(b.dataset.value === value));
  }
  render();
}

/** Mount a direction: the bar's choices, the device, the taps, a long press. */
function mountTablet(dir) {
  DIR = dir;
  S.opt = dir.option.default;
  Object.assign(S, dir.state ?? {});
  canvas = document.querySelector('.canvas');
  fitBox = document.querySelector('.fit');
  device = document.querySelector('.device');
  screen = document.querySelector('.screen');
  app = document.querySelector('.app');
  saidEl = document.querySelector('[data-said]');
  if (!root.dataset.theme) root.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  let before = root.dataset.device;
  wireBar((attr, value) => {
    if (attr === 'device' && before && value !== before) {
      const was = DEVICES[before];
      const now = DEVICES[value];
      DIR.onDevice?.(was, now, context());
      say(dir.unfoldSay?.(was, now) ?? `Now ${now.name}`);
    }
    if (attr === 'device') before = value;
    if (device) render(attr === 'device' ? 'in' : '');
  });
  render();
  screen.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    if (S.longFired) { S.longFired = false; return; }
    act(el.dataset.act, el);
  });
  // A long press: a row's menu, as the phone's (no drag: a finger scrolls and never lifts a row).
  let timer = 0;
  screen.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-long]');
    if (!el || !DIR.long) return;
    timer = setTimeout(() => { S.longFired = true; DIR.long(el, context()); }, 480);
  });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) screen.addEventListener(ev, () => clearTimeout(timer));
  screen.addEventListener('contextmenu', (e) => {
    const el = e.target.closest('[data-long]');
    if (!el || !DIR.long) return;
    e.preventDefault();
    clearTimeout(timer);
    DIR.long(el, context());
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (S.menu) { S.menu = null; render(); } else if (S.settings) { S.settings = null; render(); }
  });
  new ResizeObserver(fit).observe(canvas);
}
