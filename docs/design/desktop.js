'use strict';
/* Eien — desktop mockup. Plain JS, no libraries, no network.
   The vault is the small object below; everything else draws it. */

/* ═══ Helpers ═══════════════════════════════════════════════════════════ */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmt = (n) => n.toLocaleString('en-US');
const countWords = (s) => (s.match(/\S+/g) || []).length;
const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];
const clone = (blocks) => blocks.map((b) => ({ ...b }));

/** Make an element: h('p', { class: 'x', text: 'hi' }, child, child) */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const sep = (text = '·') => h('span', { class: 'sep', 'aria-hidden': 'true', text: ` ${text} ` });

/* ═══ The vault: Ink & Ash ══════════════════════════════════════════════ */
const P = (text) => ({ t: 'p', text });
const BREAK = { t: 'break' };
const C = (done, text) => ({ t: 'check', done, text });

const NOW = Date.now();
const MIN = 60000;

const SEVENTEEN = [
  P('“Look,” he begins more softly. “I’m not going to let you ruin the mission when the only thing on your mind is this damn scarf. If you want it back so badly, hold it still.”'),
  P('It takes her a minute to collect herself. Then, she takes the end he’s holding out. The one that isn’t split.'),
  P('He drapes the broken one across his legs a moment later; threads the needle in; and starts.'),
  BREAK,
  P('She watches as he mends the seams. She’s only known him for the merciless work, not the delicate kind.'),
  P('The stitches are neat and as he works his way through, they each hold taut.'),
  P('The welling in her eyes has faded. The tension in her shoulders subsides.'),
  P('Her eyes drift idly up to his face; then the hair.'),
  P('“What are you staring at?”'),
  P('The break in silence surprises her.'),
  P('“You’re greying,” she replies honestly.'),
  P('It’s the one time he bothers to pause. “Are you trying to pick a fight?”'),
  P('“No. You asked what I was looking at.”'),
  P('He doesn’t reply.'),
  BREAK,
  P('It takes a long time—to the point the fire begins to dim—but he doesn’t hurry.'),
  P('When he’s done, he bites off the thread with his teeth. Checks it once; twice; and holds it out.'),
  P('She takes it. The stitches are almost invisible.'),
];

/** A copy of `blocks` with some paragraphs rewritten (by index), cut at `upTo`. */
const edit = (blocks, changes, upTo = blocks.length) =>
  blocks.slice(0, upTo).map((b, i) => (i in changes ? P(changes[i]) : b));

// The last seal, two hours ago: four places differ from the draft (the brief's list).
const SEALED_2H = edit(SEVENTEEN, {
  1: 'It takes her a long minute to collect herself. Then, she takes the end he’s holding out. The one that isn’t split.',
  4: 'She watches him work. She’s only known him for the merciless work, not the delicate kind.',
  6: 'The tension in her shoulders subsides.',
  11: 'He pauses, just once. “Are you trying to pick a fight?”',
});
// "before the rewrite": the night before, without the last scene.
const SEALED_NAMED = edit(SEALED_2H, { 5: 'The stitches are neat. Each one holds.' }, 14);
// Oct 12: the first scene alone.
const SEALED_OCT12 = edit(SEALED_2H, { 2: 'He drapes the broken one across his knees and starts.' }, 3);
// What the other device has, for the sync-conflict state.
const PHONE = [
  ...SEVENTEEN.slice(0, -1),
  P('She takes it. The stitches are almost invisible. She doesn’t thank him; he doesn’t expect her to.'),
];

const FOLDERS = [
  {
    id: 'fic',
    name: 'Fic',
    children: [
      { id: 'scarf', name: 'A Mended Scarf', book: true },
      { id: 'walls', name: 'Beneath the Walls', book: true },
      { id: 'oneshots', name: 'One-shots', count: 22 },
    ],
  },
  {
    id: 'notes',
    name: 'Notes',
    children: [
      { id: 'characters', name: 'Characters', count: 37 },
      { id: 'places', name: 'Places', count: 19 },
      { id: 'research', name: 'Research', count: 64 },
      { id: 'scraps', name: 'Scraps', count: 78 },
    ],
  },
  { id: 'checklists', name: 'Checklists', count: 12 },
  { id: 'reading', name: 'Reading', count: 61 },
];

const TAGS = [
  {
    id: 'fic',
    count: 41,
    children: [{ id: 'fic/aot', count: 33, children: [{ id: 'fic/aot/canon-divergence', count: 9 }] }],
  },
  { id: 'draft', count: 14 },
  { id: 'posted', count: 22 },
  { id: 'ideas', count: 57 },
  { id: 'research', count: 64 },
  { id: 'todo', count: 8 },
];

const VAULT = { notes: 312, words: 48210 };

/* Notes: [title, words, when, first line, tags, extra]. `when` is 2m, 3h, yesterday or Oct 12. */
const NOTES = [];
function add(folder, rows) {
  for (const [title, words, when, line, tags = '', extra = {}] of rows) {
    NOTES.push({
      id: extra.id || `n${NOTES.length}`,
      folder,
      title,
      words,
      when,
      tags: tags.split(' ').filter(Boolean),
      body: extra.body || (line ? [P(line)] : []),
      pinned: !!extra.pinned,
      draft: !!extra.draft,
      versions: extra.versions,
    });
  }
}

add('scarf', [
  ['The Tear', 2140, 'Oct 12', '', 'fic/aot posted', {
    id: 'tear',
    body: [
      P('The scarf catches on a splinter of the ruined wall and gives with a sound she feels in her teeth.'),
      P('She doesn’t stop. You don’t stop, out here; you ride and you count the horses and you find out what you lost when the gate is shut behind you.'),
      P('It is only that night, in the barracks, that she unwinds it and finds the tear: a hand’s width, right where it crosses her heart.'),
    ],
  }],
  ['Needle and Thread', 1987, 'Oct 15', '', 'fic/aot posted', {
    id: 'needle',
    body: [
      P('There is a sewing kit in the supply cart, wrapped in oilcloth, that nobody has opened since Trost.'),
      P('She finds it on the second night. She finds, too, that knowing where a needle goes is not the same as getting it there.'),
      P('By the fourth night the tear is worse, and he has been watching her from across the fire for an hour.'),
    ],
  }],
  ['Seventeen', 1204, '2m', '', 'fic/aot draft', {
    id: 'seventeen',
    body: clone(SEVENTEEN),
    versions: [
      { at: NOW - 120 * MIN, blocks: SEALED_2H },
      { label: 'yesterday 23:40', name: 'before the rewrite', blocks: SEALED_NAMED },
      { label: 'Oct 12', blocks: SEALED_OCT12 },
    ],
  }],
  ['Ash on the Wind', 612, 'yesterday', '', 'fic/aot draft', {
    id: 'ash',
    draft: true,
    body: [
      P('Morning comes grey over the ridge, and the fire is only ash now.'),
      P('She wears the scarf. He doesn’t mention it. That, she will decide later, is the kindest thing anyone has said to her in a year.'),
    ],
  }],
  ['', 0, '3h', '', 'fic/aot draft', { id: 'untitled', versions: [] }],
]);

add('walls', [
  ['The Last Bell', 3412, 'Sep 2', 'The bell over the inner gate rings three times, then stops, and the whole district holds its breath.', 'fic/aot posted'],
  ['Wall Rose, at Dusk', 2876, 'Sep 4', 'From the top of the wall the farmland looks like a quilt someone forgot to finish.', 'fic/aot posted'],
  ['Rations', 2204, 'Sep 6', 'Half a loaf, a strip of dried meat, and a lecture about waste from a man who never finishes his tea.', 'fic/aot posted'],
  ['What the Recruits Say', 3051, 'Sep 9', 'They have a name for him in the barracks, and none of them will say it where he can hear.', 'fic/aot posted'],
  ['Night Watch', 2388, 'Sep 11', 'Two lanterns, one blanket, and eleven hours until the relief arrives.', 'fic/aot posted'],
  ['A Borrowed Coat', 2642, 'Sep 13', 'The coat is too big in the shoulders and smells of gun oil and cedar.', 'fic/aot fic/aot/canon-divergence posted'],
  ['The Gate Holds', 3980, 'Sep 16', 'Nobody cheers when the gate holds. They are too tired to cheer.', 'fic/aot fic/aot/canon-divergence posted'],
  ['Smoke Signals', 2115, 'Sep 18', 'Green smoke from the east ridge: come back. Red from the west: don’t.', 'fic/aot fic/aot/canon-divergence posted'],
  ['Before the Thaw', 2730, 'Sep 21', 'The river is still frozen at the edges, and the scouts walk it like a road.', 'fic/aot fic/aot/canon-divergence posted'],
  ['The Ledger', 1906, 'Sep 23', 'Every name is written twice: once when they arrive, once when they don’t come back.', 'fic/aot fic/aot/canon-divergence posted'],
  ['Under the Ramparts', 2559, 'Sep 26', 'There are tunnels under the old wall that the maps forgot.', 'fic/aot fic/aot/canon-divergence posted'],
  ['Quiet Hours', 1843, 'Sep 30', 'For one afternoon there is nothing to do, and nobody knows how.', 'fic/aot fic/aot/canon-divergence posted'],
  ['The Long Corridor', 1120, 'Oct 3', 'Forty doors, and she has the key to none of them.', 'fic/aot draft', { draft: true }],
  ['Beneath the Walls', 380, 'Oct 5', 'Notes for the ending: the wall, the river, the coat returned?', 'fic/aot draft', { draft: true }],
]);

add('oneshots', [
  ['Trost, after', 3870, '5h', 'Nobody talks about the smell. That’s the first thing she’d tell anyone who asked.', 'fic/aot posted'],
  ['Small Hours', 1460, 'yesterday', 'He makes tea at three in the morning because the alternative is thinking.', 'fic/aot posted'],
  ['The Cartographer’s Daughter', 5210, 'Oct 14', 'She draws the map from memory and gets the river wrong on purpose.', 'fic/aot fic/aot/canon-divergence draft'],
  ['Salt', 2980, 'Oct 9', 'The sea is exactly as large as he said it would be, and she hates him a little for that.', 'fic/aot posted'],
  ['Five Times She Didn’t Say It', 4420, 'Oct 3', 'One: the stables, the night before the expedition.', 'fic/aot posted'],
  ['Field Dressing', 890, 'Sep 28', 'Hold still. No — still. You call that still?', 'fic/aot draft'],
  ['A Letter Never Sent', 1210, 'Sep 21', 'Commander, I am writing because nobody else will.', 'fic/aot posted'],
  ['Spring Cleaning', 1650, 'Sep 12', 'Someone has to dust the war room, and apparently it’s her.', 'fic/aot posted'],
  ['Off Duty', 720, 'Aug 30', 'Three hours of leave and nowhere to spend them.', 'fic/aot draft'],
  ['Lanterns', 2310, 'Aug 22', 'The festival goes on inside the walls as if nothing is outside them.', 'fic/aot posted'],
]);

add('characters', [
  ['Character voice sheet', 1320, 'Oct 16', 'Her: short sentences, never asks what she already knows. Him: dry, clipped, kind only in what he does.', '', { pinned: true }],
  ['The Captain — habits and tells', 860, 'yesterday', 'Cleans when he’s anxious. Holds the cup by the rim. Never says sorry; says “that was poorly done.”', ''],
  ['The Recruit', 540, 'Oct 15', 'Seventeen in chapter iii. The scarf is in every scene; it’s her one soft thing.', ''],
  ['The Commander', 410, 'Oct 11', 'Speaks in plans. Ends conversations by leaving the room.', ''],
  ['The Medic', 280, 'Oct 8', 'Hums when stitching. Counts under her breath.', ''],
  ['Squad roster', 350, 'Oct 6', 'Who is alive at the start of chapter iv, and who should be.', ''],
  ['Dialogue tics', 620, 'Oct 2', 'He says “oi” instead of names. She answers with the shortest true thing.', ''],
  ['Minor cast', 300, 'Sep 25', 'The quartermaster with the limp; the twins on the wall; the cook who saves her bread.', ''],
  ['Ages and birthdays', 190, 'Sep 19', 'She turns seventeen in chapter iii — check the timeline against ii.', 'todo'],
]);

add('places', [
  ['Supply routes (map notes)', 740, '4h', 'North road floods in spring; the forest road is longer but dry.', 'research'],
  ['The old barracks', 380, 'Oct 13', 'Bunks of eight. The stove that only works if you kick it.', ''],
  ['Wall Rose, south gate', 450, 'Oct 10', 'Two towers, one lift, a staircase nobody trusts.', ''],
  ['The forest camp', 310, 'Oct 7', 'Clearing by a stream; the fire from chapter iii is here.', ''],
  ['Inner district markets', 290, 'Sep 30', 'Bread, cloth, rumours. Prices double after every expedition.', ''],
  ['The infirmary', 260, 'Sep 17', 'Twelve beds, too few blankets, a window that faces the wall.', ''],
]);

add('research', [
  ['Scarf symbolism', 980, '1h', 'Red scarf as home, as debt, as the thing she won’t put down. Mending as forgiveness?', 'research ideas'],
  ['Period sewing kits', 640, 'yesterday', 'Bone needles or steel; waxed linen thread; why a soldier would carry one.', 'research'],
  ['How long a fire burns', 310, 'Oct 14', 'A small fire of dry pine: about an hour without feeding. Embers for longer.', 'research'],
  ['Field medicine, 1800s', 1150, 'Oct 9', 'Lint, linen and spirits. Stitching with silk if you could get it.', 'research'],
  ['Wool, and how it tears', 420, 'Oct 4', 'Knitted wool runs; woven wool frays. Which is her scarf?', 'research'],
  ['Greying early', 260, 'Sep 29', 'Stress and premature greying: the evidence is mixed, but the image is true.', 'research'],
  ['Ranks and address', 330, 'Sep 22', 'Recruits say “sir”; peers use the name; nobody uses his first one.', 'research'],
  ['Winter on the plains', 470, 'Sep 15', 'Snow by late autumn; the river freezes at the edges first.', 'research'],
]);

add('scraps', [
  ['A Mended Scarf — outline', 1480, '1h', 'i the tear · ii needle and thread · iii seventeen · iv ash on the wind · v the return?', 'fic/aot', { pinned: true }],
  ['Lines I want to use', 520, '3h', '“You’re greying.” / “The stitches are almost invisible.” / something about ash and snow.', 'ideas'],
  ['Ideas — winter arc', 760, 'yesterday', 'They’re snowed in at the forest camp for a week. Nobody is allowed to be kind about it.', 'ideas'],
  ['Title ideas', 140, 'Oct 13', 'Mended. What the Fire Kept. Seventeen Stitches. Ash on the Wind.', 'ideas'],
  ['Scene I cut from ii', 690, 'Oct 11', 'She tried to sew it herself first, badly, in the dark.', 'fic/aot ideas'],
  ['Summary drafts', 230, 'Sep 27', 'A scarf, a needle, a captain with no patience and all the time in the world.', 'fic/aot ideas'],
  ['Song for the road', 180, 'Sep 20', 'Something the recruits would sing badly, and loudly, on the way out.', 'ideas'],
]);

add('checklists', [
  ['AO3 posting checklist', 96, 'yesterday', '', 'todo', {
    pinned: true,
    body: [
      C(true, 'Title, summary and author’s notes'),
      C(true, 'Rating, warnings and category'),
      C(true, 'Fandom, relationships, characters'),
      C(false, 'Additional tags — check how they’re wrangled'),
      C(false, 'Italics survived the paste'),
      C(false, 'Scene breaks show as * * *'),
      C(false, 'Chapter number matches the book’s order'),
      C(false, 'Post Friday, late'),
    ],
  }],
  ['Before posting a chapter', 120, 'Oct 14', 'Read it aloud. Check the timeline. Cut every second “just”.', 'todo'],
  ['Weekly', 80, 'Oct 12', 'Answer comments · one scene, at least · seal what’s finished', 'todo'],
  ['Beta notes to address', 210, 'Oct 8', 'Pacing in ii; the tea scene runs long; more of the fire.', 'todo fic/aot'],
  ['Tags I always forget', 60, 'Sep 18', 'Canon divergence, slow burn, hurt/comfort, angst with a happy ending.', 'todo'],
]);

add('reading', [
  ['Reading: The Remains of the Day', 1240, '6h', 'Restraint as the whole engine. Everything important is said by not saying it.', ''],
  ['Reading: Gilead', 860, 'Oct 15', 'The long letter. Light on water. A voice that forgives as it goes.', ''],
  ['Reading: Wolf Hall', 1410, 'Oct 10', 'Present tense, and “he” always meaning one man. Steal the closeness.', ''],
  ['Reading: A Wizard of Earthsea', 720, 'Oct 1', 'Names as power. The shadow is the self.', ''],
  ['Reading: The Left Hand of Darkness', 990, 'Sep 24', 'The ice crossing. Two people, one tent, no lies left.', ''],
  ['Reading: Never Let Me Go', 650, 'Sep 14', 'A calm voice telling terrible things.', ''],
  ['Fic recs from the server', 430, 'Sep 9', 'The one with the lighthouse; the one where they run the bakery.', 'fic'],
]);

/* Derived facts about notes */
const MONTHS = { Aug: 7, Sep: 8, Oct: 9 };
const TODAY = new Date(2026, 9, 19, 23, 10);
function minutesAgo(when) {
  const m = /^(\d+)([mh])$/.exec(when);
  if (m) return Number(m[1]) * (m[2] === 'h' ? 60 : 1);
  if (when === 'now') return 0;
  if (when === 'yesterday') return 1440;
  const [mon, day] = when.split(' ');
  return Math.round((TODAY - new Date(2026, MONTHS[mon], Number(day))) / MIN);
}
const bodyWords = (blocks) => blocks.reduce((n, b) => n + (b.t === 'break' ? 0 : countWords(b.text)), 0);
for (const n of NOTES) {
  n.ago = minutesAgo(n.when);
  n.offset = n.words - bodyWords(n.body); // the mockup shows an excerpt; counts stay true to the list
  n.counted = bodyWords(n.body);
  if (!n.versions) {
    const at = n.ago < 1440 ? NOW - n.ago * MIN : null;
    n.versions = [{ at, label: at ? null : n.when, blocks: clone(n.body) }];
  }
}
const noteWords = (n) => Math.max(0, n.offset + bodyWords(n.body));
const versionWords = (n, v) => Math.max(0, n.offset + bodyWords(v.blocks));
const previewOf = (n) =>
  n.body.filter((b) => b.t !== 'break').map((b) => b.text).slice(0, n.body[0]?.t === 'check' ? 4 : 1).join(' · ');
const byId = (id) => NOTES.find((n) => n.id === id);

function findFolder(id, list = FOLDERS, parent = null) {
  for (const f of list) {
    if (f.id === id) return { folder: f, parent };
    if (f.children) {
      const hit = findFolder(id, f.children, f);
      if (hit) return hit;
    }
  }
  return null;
}
const ownNotes = (f) => NOTES.filter((n) => n.folder === f.id);
const allNotesIn = (f) => [...ownNotes(f), ...(f.children || []).flatMap(allNotesIn)];
const folderCount = (f) =>
  f.children ? f.children.reduce((s, c) => s + folderCount(c), 0) : f.book || f.count == null ? ownNotes(f).length : f.count;

// Every leaf folder keeps its own order (spec §2); a book's is its chapter order.
function initOrder(f) {
  if (f.children) return f.children.forEach(initOrder);
  const notes = ownNotes(f);
  f.order = (f.book ? notes : [...notes].sort((a, b) => a.ago - b.ago)).map((n) => n.id);
}
FOLDERS.forEach(initOrder);
const inOrder = (f) => f.order.map(byId).filter(Boolean);
const ordinalOf = (n) => {
  const f = findFolder(n.folder)?.folder;
  return f?.book ? f.order.indexOf(n.id) : -1;
};

function versionWhen(v) {
  if (!v.at) return v.label;
  const m = Math.round((Date.now() - v.at) / MIN);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.round(m / 60)}h ago`;
}

/* ═══ State ═════════════════════════════════════════════════════════════ */
const css = getComputedStyle(document.documentElement);
const token = (name) => parseFloat(css.getPropertyValue(name));

const state = {
  theme: 'system',
  face: 'newsreader', // the text face; read from storage at start
  panes: 3,
  sidebar: true,
  list: true,
  sbW: token('--eien-sidebar-w'),
  sbW2: token('--eien-sidebar-w') + token('--eien-space-7'),
  lsW: token('--eien-list-w'),
  sel: 'f:scarf',
  open: new Set(['f:fic', 'f:scarf', 't:fic']),
  sections: { library: true, folders: true, tags: true },
  sort: {},
  query: '',
  noteId: 'seventeen',
  view: 'live',
  compare: 'draft',
  against: 0,
  versions: false,
  conflict: false,
  empty: false,
  today: 809,
  sprint: 12 * 60 + 40,
  msg: null,
  treeFocus: null,
};
const current = () => byId(state.noteId);

/* ═══ Sidebar: the contents page ════════════════════════════════════════ */
const LIBRARY = [
  { id: 'all', name: 'All Notes' },
  { id: 'pinned', name: 'Pinned' },
];

function libNode(l) {
  const notes = () => (l.id === 'all' ? [...NOTES].sort((a, b) => a.ago - b.ago).slice(0, 14) : NOTES.filter((n) => n.pinned));
  return {
    key: `l:${l.id}`,
    name: l.name,
    count: l.id === 'all' ? fmt(VAULT.notes + NOTES.length - BASE_NOTES) : String(NOTES.filter((n) => n.pinned).length),
    kids: () => (state.panes === 2 ? notes().map((n) => noteNode(n)) : []),
  };
}
function folderNode(f) {
  return {
    key: `f:${f.id}`,
    name: f.name,
    count: fmt(folderCount(f)),
    book: f.book,
    kids: () => [
      ...(f.children || []).map(folderNode),
      ...(state.panes === 2 && !f.children ? inOrderOrSorted(f).map((n) => noteNode(n, f.book)) : []),
    ],
  };
}
function tagNode(t) {
  return {
    key: `t:${t.id}`,
    name: t.id.split('/').pop(),
    hash: true,
    count: fmt(t.count),
    kids: () => [
      ...(t.children || []).map(tagNode),
      ...(state.panes === 2 ? NOTES.filter((n) => n.tags.includes(t.id)).sort((a, b) => a.ago - b.ago).map((n) => noteNode(n)) : []),
    ],
  };
}
function noteNode(n, book = false) {
  return {
    key: `n:${n.id}`,
    name: n.title || 'Untitled',
    untitled: !n.title,
    note: n,
    ord: book ? ordinalOf(n) : -1,
    count: book ? fmt(noteWords(n)) : n.when,
    kids: () => [],
  };
}
function inOrderOrSorted(f) {
  const sort = state.sort[`f:${f.id}`] || (f.book ? 'order' : 'modified');
  return sortNotes(inOrder(f), sort);
}

function isSelected(node) {
  if (node.note) return node.note.id === state.noteId;
  return state.panes === 3 && node.key === state.sel;
}

function treeItem(node, depth) {
  const kids = node.kids();
  const expandable = kids.length > 0;
  const open = expandable && state.open.has(node.key);
  const li = h('li', {
    role: 'treeitem',
    'data-key': node.key,
    tabindex: '-1',
    'aria-level': String(depth + 1),
    'aria-expanded': expandable ? String(open) : null,
    'aria-selected': isSelected(node) ? 'true' : null,
  });
  li.append(
    h(
      'div',
      { class: `row${node.note ? ' row--note' : ''}${node.untitled ? ' is-untitled' : ''}`, style: `--depth:${depth}` },
      h('span', { class: `twisty${expandable ? '' : ' twisty--leaf'}`, 'data-twisty': '', 'aria-hidden': 'true' }),
      node.ord >= 0 ? h('span', { class: 'row__ord', text: ROMAN[node.ord] }) : null,
      h('span', { class: 'row__name' }, node.hash ? h('span', { class: 'row__hash', text: '#' }) : null, node.name),
      node.book ? h('span', { class: 'book-mark', text: 'Book' }) : null,
      h('span', { class: 'count', text: node.count }),
    ),
  );
  if (open) {
    const group = h('ul', { role: 'group', style: `--depth:${depth}` });
    for (const k of kids) group.append(treeItem(k, depth + 1));
    li.append(group);
  }
  return li;
}

function section(id, label, nodes, count) {
  const open = state.sections[id] !== false;
  return h(
    'div',
    { class: 'section' },
    h(
      'button',
      { class: 'section__label', type: 'button', 'data-section': id, 'aria-expanded': String(open), 'aria-controls': `tree-${id}` },
      h('span', {}, label, count != null ? h('span', { class: 'section__count', text: `  ${count}` }) : null),
      h('span', { class: 'twisty', 'aria-hidden': 'true' }),
    ),
    h('ul', { class: 'tree', role: 'tree', id: `tree-${id}`, 'aria-label': label, hidden: !open }, nodes.map((n) => treeItem(n, 0))),
  );
}

function renderSidebar() {
  const root = $('#tree-root');
  const focused = root.contains(document.activeElement) ? document.activeElement : null;
  const focusKey = focused?.dataset.key;
  const focusSection = focused?.dataset.section;
  root.replaceChildren();
  if (state.panes === 2 && state.query) {
    const hits = search(state.query);
    root.append(section('results', 'Results', hits.map((n) => noteNode(n)), hits.length));
    if (!hits.length) root.append(h('p', { class: 'empty__line', style: 'padding: 0 var(--eien-space-4)', text: 'No notes match.' }));
  } else {
    root.append(
      section('library', 'Library', LIBRARY.map(libNode)),
      section('folders', 'Folders', FOLDERS.map(folderNode)),
      section('tags', 'Tags', TAGS.map(tagNode)),
    );
  }
  // Roving tabindex: one stop per tree, on the focused, selected or first item.
  for (const tree of $$('[role="tree"]', root)) {
    const items = $$('[role="treeitem"]', tree);
    const stop =
      items.find((i) => i.dataset.key === state.treeFocus) ||
      items.find((i) => i.getAttribute('aria-selected') === 'true') ||
      items[0];
    if (stop) stop.tabIndex = 0;
  }
  if (focusKey) $(`[data-key="${CSS.escape(focusKey)}"]`, root)?.focus();
  else if (focusSection) $(`[data-section="${focusSection}"]`, root)?.focus();
  renderFoot();
}

function visibleTreeItems() {
  return $$('[role="treeitem"]', $('#tree-root')).filter((li) => !li.closest('[hidden]'));
}
function focusTreeItem(li) {
  if (!li) return;
  for (const other of $$('[role="treeitem"]', li.closest('[role="tree"]'))) other.tabIndex = -1;
  li.tabIndex = 0;
  state.treeFocus = li.dataset.key;
  li.focus();
}
function toggleOpen(key, force) {
  const open = force ?? !state.open.has(key);
  if (open) state.open.add(key);
  else state.open.delete(key);
  state.treeFocus = key;
  renderSidebar();
}
function activateTreeItem(li) {
  const key = li.dataset.key;
  state.treeFocus = key;
  if (key.startsWith('n:')) return openNote(key.slice(2));
  if (state.panes === 2) return li.hasAttribute('aria-expanded') && toggleOpen(key);
  selectList(key);
}
function selectList(key) {
  state.sel = key;
  state.query = '';
  for (const f of $$('[data-search]')) f.value = '';
  renderSidebar();
  renderList();
  $('#rows').scrollTop = 0;
}

function bindSidebar() {
  const root = $('#tree-root');
  root.addEventListener('click', (e) => {
    const label = e.target.closest('.section__label');
    if (label) {
      const id = label.dataset.section;
      state.sections[id] = state.sections[id] === false;
      return renderSidebar();
    }
    const li = e.target.closest('[role="treeitem"]');
    if (!li) return;
    if (e.target.closest('[data-twisty]') && li.hasAttribute('aria-expanded')) return toggleOpen(li.dataset.key);
    activateTreeItem(li);
  });
  root.addEventListener('dblclick', (e) => {
    const li = e.target.closest('[role="treeitem"]');
    if (li?.hasAttribute('aria-expanded') && state.panes === 3) toggleOpen(li.dataset.key);
  });
  root.addEventListener('keydown', (e) => {
    const li = e.target.closest('[role="treeitem"]');
    if (!li || e.target !== li) return;
    const items = visibleTreeItems();
    const i = items.indexOf(li);
    const expandable = li.hasAttribute('aria-expanded');
    const open = li.getAttribute('aria-expanded') === 'true';
    const keys = {
      ArrowDown: () => focusTreeItem(items[i + 1]),
      ArrowUp: () => focusTreeItem(items[i - 1]),
      Home: () => focusTreeItem(items[0]),
      End: () => focusTreeItem(items.at(-1)),
      ArrowRight: () => (expandable && !open ? toggleOpen(li.dataset.key, true) : open && focusTreeItem($('[role="treeitem"]', li))),
      ArrowLeft: () => (open ? toggleOpen(li.dataset.key, false) : focusTreeItem(li.parentElement.closest('[role="treeitem"]'))),
      Enter: () => activateTreeItem(li),
      ' ': () => activateTreeItem(li),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  });
  root.addEventListener('focusin', (e) => {
    const li = e.target.closest('[role="treeitem"]');
    if (li && e.target === li) state.treeFocus = li.dataset.key;
  });
}

/* ═══ Note list: the index ══════════════════════════════════════════════ */
const SORTS = { order: 'Order', title: 'Title', modified: 'Modified' };
function sortNotes(notes, sort) {
  if (sort === 'title') return [...notes].sort((a, b) => (a.title || '~').localeCompare(b.title || '~'));
  if (sort === 'modified') return [...notes].sort((a, b) => a.ago - b.ago);
  return notes;
}
function search(q) {
  const needle = q.toLowerCase();
  return NOTES.filter((n) =>
    [n.title, ...n.body.map((b) => b.text || '')].some((s) => s.toLowerCase().includes(needle)),
  ).sort((a, b) => a.ago - b.ago);
}

/** What the list shows now: a folder, a tag, the library, or a search. */
function listContext() {
  if (state.query) {
    const notes = search(state.query);
    return { key: 'search', title: `“${state.query}”`, meta: `${notes.length} ${notes.length === 1 ? 'note matches' : 'notes match'}`, notes, sorts: [] };
  }
  const [kind, id] = [state.sel.slice(0, 1), state.sel.slice(2)];
  const pick = (base, ctx) => {
    const sort = state.sort[state.sel] || ctx.defaultSort || 'modified';
    return { ...ctx, key: state.sel, sort, notes: sortNotes(base, sort) };
  };
  if (kind === 'f') {
    const f = findFolder(id).folder;
    const leaf = !f.children;
    const base = leaf ? inOrder(f) : allNotesIn(f);
    const count = folderCount(f);
    const meta = [`${fmt(count)} ${count === 1 ? 'note' : 'notes'}`];
    if (f.book) meta.push(`${fmt(base.reduce((s, n) => s + noteWords(n), 0))} words`, 'book');
    return pick(base, {
      title: f.name,
      meta: meta.join(' · '),
      folder: f,
      book: f.book,
      sorts: leaf ? ['order', 'title', 'modified'] : ['title', 'modified'],
      defaultSort: f.book ? 'order' : 'modified',
    });
  }
  if (kind === 't') {
    const t = flatTags().find((x) => x.id === id);
    const base = NOTES.filter((n) => n.tags.some((tag) => tag === id || tag.startsWith(`${id}/`)));
    return pick(base, { title: `#${id}`, meta: `${t.count} notes · tag`, sorts: ['title', 'modified'] });
  }
  if (id === 'pinned') {
    const base = NOTES.filter((n) => n.pinned);
    return pick(base, { title: 'Pinned', meta: `${base.length} notes · pinned`, sorts: ['title', 'modified'] });
  }
  return pick(NOTES, {
    title: 'All Notes',
    meta: `${fmt(VAULT.notes + NOTES.length - BASE_NOTES)} notes · ${fmt(vaultWords())} words`,
    sorts: ['title', 'modified'],
  });
}
const flatTags = (list = TAGS) => list.flatMap((t) => [t, ...flatTags(t.children || [])]);

function noteRow(n, ctx) {
  const ord = ctx.book ? ordinalOf(n) : -1;
  const flag =
    state.conflict && n.id === 'seventeen'
      ? h('span', { class: 'note-row__flag note-row__flag--conflict', text: 'Conflict' })
      : n.draft
        ? h('span', { class: 'note-row__flag', text: 'Draft' })
        : n.pinned && state.sel !== 'l:pinned'
          ? h('span', { class: 'note-row__flag', title: 'Pinned' }, h('span', { class: 'ribbon', 'aria-hidden': 'true' }), h('span', { class: 'visually-hidden', text: 'pinned' }))
          : null;
  const preview = previewOf(n);
  return h(
    'div',
    {
      class: `note-row${n.title ? '' : ' is-untitled'}`,
      role: 'option',
      tabindex: '-1',
      'data-id': n.id,
      'aria-selected': n.id === state.noteId ? 'true' : 'false',
    },
    ord >= 0 ? h('span', { class: 'note-row__ord', text: ROMAN[ord] }) : null,
    h('span', { class: 'note-row__title', text: n.title || 'Untitled' }),
    h('span', { class: 'note-row__meta count', text: ctx.book ? `${fmt(noteWords(n))} w` : n.when }),
    h('span', { class: `note-row__preview${preview ? '' : ' is-empty'}`, text: preview || 'Empty' }),
    flag,
  );
}

function renderList() {
  const ctx = listContext();
  const rows = $('#rows');
  const hadFocus = rows.contains(document.activeElement) ? document.activeElement.dataset.id : null;
  $('#list-title').textContent = ctx.title;
  $('#list-meta').textContent = ctx.meta;
  const sortButton = $('#sort-button');
  sortButton.hidden = !ctx.sorts.length || !ctx.notes.length;
  sortButton.textContent = `${SORTS[ctx.sort] || 'Order'} ▾`;
  sortButton.title = ctx.sort === 'order' ? 'In the folder’s own order: drag to reorder' : '';
  rows.classList.toggle('rows--book', !!ctx.book);
  rows.replaceChildren(...ctx.notes.map((n) => noteRow(n, ctx)));
  if (!ctx.notes.length) {
    rows.append(
      ctx.key === 'search'
        ? h('div', { class: 'empty' }, h('p', { class: 'empty__line', text: 'No notes match.' }), h('button', { class: 'word-button', type: 'button', 'data-action': 'clear-search', text: 'Clear search' }))
        : h('div', { class: 'empty' }, h('p', { class: 'empty__line', text: 'Nothing here yet.' }), h('button', { class: 'word-button', type: 'button', 'data-action': 'new-note', text: 'New note' })),
    );
  }
  const items = $$('.note-row', rows);
  const stop = items.find((r) => r.dataset.id === hadFocus) || items.find((r) => r.dataset.id === state.noteId) || items[0];
  if (stop) stop.tabIndex = 0;
  if (hadFocus && stop) stop.focus();
  state.listCtx = ctx;
}

function focusRow(row) {
  if (!row) return;
  for (const r of $$('.note-row', $('#rows'))) r.tabIndex = -1;
  row.tabIndex = 0;
  row.focus();
  row.scrollIntoView({ block: 'nearest' });
}
const canReorder = () => state.listCtx?.sort === 'order' && state.listCtx.folder && !state.listCtx.folder.children;

function moveNote(id, toIndex) {
  const f = state.listCtx.folder;
  const order = f.order.filter((x) => x !== id);
  order.splice(Math.max(0, Math.min(toIndex, order.length)), 0, id);
  f.order = order;
  renderList();
  if (state.panes === 2) renderSidebar();
  renderHead();
  const n = byId(id);
  announce(`${n.title || 'Untitled'} moved to ${f.book ? ROMAN[order.indexOf(id)] : `place ${order.indexOf(id) + 1}`}`);
}

function bindList() {
  const rows = $('#rows');
  let drag = null;
  let suppressClick = false;

  rows.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'new-note') return newNote();
    if (action === 'clear-search') return setQuery('');
    const row = e.target.closest('.note-row');
    if (!row) return;
    if (suppressClick) return void (suppressClick = false);
    openNote(row.dataset.id);
  });
  rows.addEventListener('keydown', (e) => {
    const row = e.target.closest('.note-row');
    if (!row || e.target !== row) return;
    const items = $$('.note-row', rows);
    const i = items.indexOf(row);
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && canReorder()) {
      e.preventDefault();
      moveNote(row.dataset.id, i + (e.key === 'ArrowUp' ? -1 : 1));
      return $(`.note-row[data-id="${row.dataset.id}"]`, rows)?.focus();
    }
    const keys = {
      ArrowDown: () => focusRow(items[i + 1]),
      ArrowUp: () => focusRow(items[i - 1]),
      Home: () => focusRow(items[0]),
      End: () => focusRow(items.at(-1)),
      Enter: () => openNote(row.dataset.id),
      ' ': () => openNote(row.dataset.id),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  });

  // Drag to reorder: pointer events, a lifted row, a hairline where it will land.
  rows.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.note-row');
    if (!row || e.button !== 0 || !canReorder()) return;
    drag = { row, id: row.dataset.id, startY: e.clientY, active: false, pointerId: e.pointerId, index: 0 };
  });
  rows.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const dy = e.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dy) < 4) return;
      drag.active = true;
      drag.row.setPointerCapture(e.pointerId);
      drag.row.classList.add('is-lifted');
      rows.classList.add('is-dragging');
      drag.marker = h('div', { class: 'drop-marker', 'aria-hidden': 'true' });
      rows.append(drag.marker);
      drag.scroll0 = rows.scrollTop;
    }
    const box = rows.getBoundingClientRect();
    if (e.clientY < box.top + 24) rows.scrollTop -= 8;
    if (e.clientY > box.bottom - 24) rows.scrollTop += 8;
    drag.row.style.transform = `translateY(${dy + rows.scrollTop - drag.scroll0}px)`;
    const others = $$('.note-row', rows).filter((r) => r !== drag.row);
    let index = others.length;
    for (let i = 0; i < others.length; i++) {
      const r = others[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        index = i;
        break;
      }
    }
    drag.index = index;
    const last = others.at(-1);
    const y = index < others.length ? others[index].offsetTop : last.offsetTop + last.offsetHeight;
    drag.marker.style.top = `${y - 1}px`;
  });
  const end = (commit) => {
    if (!drag) return;
    const { active, id, index } = drag;
    if (active) {
      drag.marker.remove();
      rows.classList.remove('is-dragging');
      drag.row.classList.remove('is-lifted');
      drag.row.style.transform = '';
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
    }
    drag = null;
    if (active && commit) moveNote(id, index);
  };
  rows.addEventListener('pointerup', () => end(true));
  rows.addEventListener('pointercancel', () => end(false));

  // Sort menu
  const button = $('#sort-button');
  const menu = $('#sort-menu');
  const closeMenu = (focusButton) => {
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focusButton) button.focus();
  };
  button.addEventListener('click', () => {
    if (!menu.hidden) return closeMenu();
    const ctx = state.listCtx;
    menu.replaceChildren(
      ...ctx.sorts.map((s) =>
        h('button', { class: 'word-button', type: 'button', role: 'menuitemradio', 'aria-checked': String(s === ctx.sort), 'data-sort': s, tabindex: '-1', text: SORTS[s] }),
      ),
      ctx.folder && !ctx.folder.children ? h('p', { class: 'menu__hint', text: 'Order: drag rows to arrange' }) : null,
    );
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    ($('[aria-checked="true"]', menu) || $('[role="menuitemradio"]', menu)).focus();
  });
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-sort]');
    if (!item) return;
    state.sort[state.sel] = item.dataset.sort;
    closeMenu(true);
    renderList();
    if (state.panes === 2) renderSidebar();
  });
  menu.addEventListener('keydown', (e) => {
    const items = $$('[role="menuitemradio"]', menu);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') items[(i + 1) % items.length].focus();
    else if (e.key === 'ArrowUp') items[(i - 1 + items.length) % items.length].focus();
    else if (e.key === 'Escape' || e.key === 'Tab') closeMenu(e.key === 'Escape');
    else return;
    e.preventDefault();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !e.target.closest('.sort')) closeMenu();
  });
}

function setQuery(q) {
  state.query = q;
  for (const f of $$('[data-search]')) if (f.value !== q) f.value = q;
  renderList();
  if (state.panes === 2) renderSidebar();
}

/* ═══ The page ══════════════════════════════════════════════════════════ */
const VIEW_NAMES = { live: 'Live', source: 'Source', reading: 'Reading' };

function crumbsOf(n) {
  const path = [];
  let hit = findFolder(n.folder);
  while (hit) {
    path.unshift(hit.folder.name);
    hit = hit.parent ? findFolder(hit.parent.id) : null;
  }
  const ord = ordinalOf(n);
  if (ord >= 0) path.push(ROMAN[ord]);
  return path;
}
function renderHead() {
  const head = $('.sheet__head');
  if (!head) return;
  const n = current();
  const path = crumbsOf(n);
  $('.crumbs', head).replaceChildren(...path.flatMap((p, i) => (i ? [sep('/'), p] : [p])));
}

function blockEl(b, editable) {
  if (b.t === 'break') return h('div', { class: 'scene-break', contenteditable: 'false', role: 'separator', 'aria-label': 'Scene break', text: '***' });
  if (b.t === 'check')
    return h(
      'p',
      { class: `check${b.done ? ' is-done' : ''}` },
      h('span', { class: 'check__box', contenteditable: 'false' }, h('input', { type: 'checkbox', checked: b.done, disabled: !editable, 'aria-label': b.text })),
      h('span', { class: 'check__text', text: b.text }),
    );
  return h('p', { text: b.text });
}
function readBlocks(prose) {
  const out = [];
  for (const node of prose.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.textContent.trim()) out.push(P(node.textContent.trim()));
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    if (node.classList.contains('scene-break')) out.push(BREAK);
    else if (node.classList.contains('check')) {
      const box = $('input', node);
      node.classList.toggle('is-done', !!box?.checked);
      out.push(C(!!box?.checked, $('.check__text', node)?.textContent.trim() ?? node.textContent.trim()));
    } else {
      const text = node.textContent.replace(/\s+/g, ' ').trim();
      if (text === '***') out.push(BREAK);
      else if (text) out.push(P(text));
    }
  }
  return out;
}

/* Word diff: a longest common subsequence over words, paragraph ends and scene breaks. */
function tokens(blocks) {
  const out = [];
  for (const b of blocks) {
    if (b.t === 'break') {
      out.push({ k: '\u0000***', brk: true });
      continue;
    }
    for (const w of b.text.split(/\s+/).filter(Boolean)) out.push({ k: w, w });
    out.push({ k: '\u0001', end: true });
  }
  return out;
}
function diff(oldBlocks, newBlocks) {
  const a = tokens(oldBlocks);
  const b = tokens(newBlocks);
  const n = a.length;
  const m = b.length;
  // Prefix table, walked back from the end: a new sentence placed before an old one
  // stays whole ("[The welling… faded.] The tension…") rather than borrowing its "The".
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++) dp[i][j] = a[i - 1].k === b[j - 1].k ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (a[i - 1].k === b[j - 1].k) ops.push({ op: 'eq', tok: b[(i--, --j)] });
    else if (dp[i][j - 1] >= dp[i - 1][j]) ops.push({ op: 'add', tok: b[--j] });
    else ops.push({ op: 'del', tok: a[--i] });
  }
  while (i > 0) ops.push({ op: 'del', tok: a[--i] });
  while (j > 0) ops.push({ op: 'add', tok: b[--j] });
  return ops.reverse();
}
/** Render a diff as paragraphs: removed words struck, added words underlined, grouped by run. */
function diffEl(ops) {
  const prose = h('div', { class: 'prose', contenteditable: 'false', tabindex: '0', 'aria-label': 'Changes, read only' });
  let para = h('p');
  let run = { del: [], add: [] };
  const stats = { del: 0, add: 0 };
  const flushRun = () => {
    if (run.del.length) para.append(h('del', { class: 'diff', text: run.del.join(' ') }), ' ');
    if (run.add.length) para.append(h('ins', { class: 'diff', text: run.add.join(' ') }), ' ');
    run = { del: [], add: [] };
  };
  const flushPara = () => {
    flushRun();
    if (para.childNodes.length) prose.append(para);
    para = h('p');
  };
  for (const { op, tok } of ops) {
    if (tok.brk) {
      flushPara();
      prose.append(h('div', { class: `scene-break${op === 'eq' ? '' : ` diff--${op}`}`, text: '***', role: 'separator', 'aria-label': op === 'eq' ? 'Scene break' : op === 'add' ? 'Scene break, added' : 'Scene break, removed' }));
    } else if (tok.end) {
      flushPara();
    } else if (op === 'eq') {
      flushRun();
      para.append(`${tok.w} `);
    } else {
      run[op].push(tok.w);
      stats[op]++;
    }
  }
  flushPara();
  return { el: prose, stats };
}

function againstOf(n) {
  if (state.against === 'phone') return { blocks: PHONE, phone: true };
  return n.versions[state.against] || n.versions[0];
}

function stateLine(kind, ...kids) {
  return h('div', { class: `sheet__state sheet__state--${kind}`, role: kind === 'conflict' ? 'alert' : 'status' }, ...kids);
}

function renderPage({ focus } = {}) {
  const n = current();
  const sheet = $('#sheet');
  const editable = state.compare === 'draft' && state.view === 'live';
  const hasConflict = state.conflict && n.id === 'seventeen';
  sheet.replaceChildren();

  if (hasConflict)
    sheet.append(
      stateLine(
        'conflict',
        h('span', {}, h('strong', { text: 'Conflict' }), ' — another device changed this note'),
        h(
          'span',
          { class: 'sheet__actions' },
          h('button', { class: 'word-button', type: 'button', 'data-action': 'conflict-compare', text: 'Compare' }),
          sep(),
          h('button', { class: 'word-button', type: 'button', 'data-action': 'keep-both', text: 'Keep both' }),
        ),
      ),
    );

  let body;
  if (state.compare === 'changes') {
    const v = againstOf(n);
    const { el, stats } = v.phone ? diffEl(diff(n.body, v.blocks)) : diffEl(diff(v.blocks, n.body));
    body = el;
    const since = v.phone
      ? ['Changes on the other device', sep(), 'phone, 12m ago']
      : v.name
        ? ['Changes since ', h('strong', { text: `“${v.name}”` }), sep(), `sealed ${versionWhen(v)}`]
        : [`Changes since the seal ${versionWhen(v)}`];
    sheet.append(
      stateLine(
        'changes',
        h('span', {}, ...since),
        h(
          'span',
          { class: 'legend' },
          stats.del ? h('del', { text: `${fmt(stats.del)} removed` }) : null,
          stats.del && stats.add ? ' ' : null,
          stats.add ? h('ins', { text: `${fmt(stats.add)} added` }) : null,
          stats.del || stats.add ? null : 'No changes',
          sep(),
          'Read only',
        ),
      ),
    );
  } else if (state.compare === 'sealed') {
    const v = againstOf(n);
    body = h('div', { class: 'prose', contenteditable: 'false', tabindex: '0', 'aria-label': 'Sealed text, read only' }, v.blocks.map((b) => blockEl(b, false)));
    sheet.append(
      stateLine(
        'sealed',
        h('span', {}, v.phone ? 'The other device’s copy — read only' : `${v.name ? `“${v.name}” · ` : ''}Sealed ${versionWhen(v)} — read only`),
        h('span', {}, 'Type to return to the draft'),
      ),
    );
  }

  sheet.append(
    h(
      'header',
      { class: 'sheet__head' },
      h('p', { class: 'crumbs' }),
      h('p', { class: 'tags' }, n.tags.map((t) => h('span', { text: `#${t}` }))),
    ),
  );

  if (!body && state.view === 'source') {
    sheet.append(sourceEl(n));
  } else {
    const title = h('h1', {
      class: 'title',
      'data-placeholder': 'Untitled',
      contenteditable: editable ? 'true' : 'false',
      spellcheck: 'false',
      text: n.title,
    });
    sheet.append(title);
    if (!body) {
      body = h(
        'div',
        {
          class: 'prose',
          contenteditable: editable ? 'true' : 'false',
          role: 'textbox',
          'aria-multiline': 'true',
          'aria-label': `${n.title || 'Untitled'} — text`,
          'aria-readonly': editable ? null : 'true',
          spellcheck: 'false',
          'data-placeholder': 'Begin anywhere.',
          tabindex: editable ? null : '0',
        },
        n.body.map((b) => blockEl(b, editable)),
      );
      body.classList.toggle('is-blank', !n.body.length);
    }
    sheet.append(body);
  }
  renderHead();
  renderBar();
  renderStatus();
  if (state.versions) renderVersions();
  if (focus === 'title') $('.title', sheet)?.focus();
  if (focus === 'end') placeCaretAtEnd($('.prose', sheet));
}

function placeCaretAtEnd(el) {
  if (!el) return;
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el.lastElementChild || el);
  range.collapse(false);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/* Source view: the raw Markdown, front matter and all. */
function toMarkdown(n) {
  const lines = ['---'];
  if (n.versions.length) lines.push('id: 01JB2X4Q7Z');
  if (n.tags.length) lines.push(`tags: [${n.tags.join(', ')}]`);
  lines.push('---', '', `# ${n.title}`, '');
  for (const b of n.body) {
    lines.push(b.t === 'break' ? '***' : b.t === 'check' ? `- [${b.done ? 'x' : ' '}] ${b.text}` : b.text);
    if (b.t !== 'check') lines.push('');
  }
  return lines.join('\n').replace(/\n+$/, '\n');
}
function sourceEl(n) {
  const pre = h('pre', {
    class: 'source',
    contenteditable: 'true',
    spellcheck: 'false',
    role: 'textbox',
    'aria-multiline': 'true',
    'aria-label': `${n.title || 'Untitled'} — Markdown source`,
  });
  let inFront = false;
  for (const [i, line] of toMarkdown(n).split('\n').entries()) {
    if (i) pre.append('\n');
    if (line === '---') {
      inFront = i === 0;
      pre.append(h('span', { class: 'md-fence', text: line }));
    } else if (inFront && /^\w+:/.test(line)) {
      const [, key, rest] = /^(\w+:)(.*)$/.exec(line);
      pre.append(h('span', { class: 'md-key', text: key }), h('span', { class: 'md-value', text: rest }));
    } else if (line.startsWith('# ')) {
      pre.append(h('span', { class: 'md-mark', text: '# ' }), h('span', { class: 'md-title', text: line.slice(2) }));
    } else if (line === '***') {
      pre.append(h('span', { class: 'md-break', text: line }));
    } else if (/^- \[[ x]\] /.test(line)) {
      pre.append(h('span', { class: 'md-mark', text: line.slice(0, 6) }), line.slice(6));
    } else pre.append(line);
  }
  return pre;
}
function fromMarkdown(text, n) {
  let rest = text.replace(/\r\n/g, '\n');
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(rest);
  if (front) {
    const tags = /tags:\s*\[(.*)\]/.exec(front[1]);
    if (tags) n.tags = tags[1].split(',').map((t) => t.trim()).filter(Boolean);
    rest = rest.slice(front[0].length);
  }
  const title = /^\s*# (.*)\n?/.exec(rest);
  if (title) {
    n.title = title[1].trim();
    rest = rest.slice(title[0].length);
  }
  const body = [];
  for (const chunk of rest.split(/\n\s*\n/)) {
    for (const line of chunk.split('\n')) {
      const check = /^- \[([ x])\] (.*)$/.exec(line.trim());
      if (check) body.push(C(check[1] === 'x', check[2]));
    }
    const t = chunk.replace(/\s+/g, ' ').trim();
    if (!t || /^- \[[ x]\]/.test(t)) continue;
    body.push(t === '***' ? BREAK : P(t));
  }
  n.body = body;
}

/* ═══ Page controls ═════════════════════════════════════════════════════ */
function renderBar() {
  const n = current();
  for (const b of $$('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
  const compare = $('#compare-button');
  const words = { draft: 'Draft', changes: 'Changes', sealed: 'Sealed' };
  compare.replaceChildren(
    h('span', { class: 'cmp-word', text: 'Compare' }),
    h('span', { class: 'cmp-sep compare-state', text: ' · ' }),
    h('span', { class: 'cmp-state compare-state', text: words[state.compare] }),
  );
  compare.setAttribute('aria-pressed', String(state.compare !== 'draft'));
  compare.disabled = !n.versions.length && !(state.conflict && n.id === 'seventeen');
  compare.title = compare.disabled ? 'Not sealed yet' : 'Compare with the last seal (⌘⇧D): Changes, then Sealed, then Draft';
  $('#versions-button').setAttribute('aria-pressed', String(state.versions));
  const sb = $('#bar-sidebar');
  sb.replaceChildren(h('span', { class: 'when-wide', text: state.sidebar ? 'Hide ' : 'Show ' }), 'Sidebar');
  const ls = $('#bar-list');
  ls.replaceChildren(h('span', { class: 'when-wide', text: state.list && state.panes === 3 ? 'Hide ' : 'Show ' }), 'List');
  ls.disabled = state.panes === 2;
  ls.title = state.panes === 2 ? 'Two panes: the tree lists the notes' : '⌘⇧\\';
}

function setView(view) {
  if (state.view === 'source' && view !== 'source') {
    const pre = $('.source');
    if (pre) fromMarkdown(pre.innerText, current());
    afterTextChange();
  }
  state.view = view;
  state.compare = 'draft';
  renderPage();
  syncMockbar();
}
function cycleView() {
  const order = ['live', 'source', 'reading'];
  setView(order[(order.indexOf(state.view) + 1) % order.length]);
}

function setCompare(mode, against = 0) {
  const n = current();
  if (mode !== 'draft' && !n.versions.length && against !== 'phone') return;
  if (state.view === 'source') {
    const pre = $('.source');
    if (pre) fromMarkdown(pre.innerText, n);
  }
  state.compare = mode;
  state.against = mode === 'draft' ? 0 : against;
  if (mode !== 'draft' && state.view === 'source') state.view = 'live';
  renderPage();
  syncMockbar();
  announce(mode === 'draft' ? 'Draft' : mode === 'changes' ? 'Changes since the seal' : 'Sealed text, read only');
}
function cycleCompare() {
  const next = { draft: 'changes', changes: 'sealed', sealed: 'draft' }[state.compare];
  setCompare(next, next === 'draft' ? 0 : state.against);
}

/* Seal (⌘S): a checkpoint. The small seal in the status line stamps; no popup. */
function seal({ quiet } = {}) {
  const n = current();
  const last = n.versions[0];
  if (last && JSON.stringify(last.blocks) === JSON.stringify(n.body)) {
    if (!quiet) flash('Nothing new to seal');
    return false;
  }
  n.versions.unshift({ at: Date.now(), blocks: clone(n.body) });
  if (state.against !== 'phone' && state.compare !== 'draft') state.against = 0;
  if (!quiet) {
    state.msg = null;
    renderStatus();
    stamp();
    announce('Sealed just now');
  }
  if (state.compare !== 'draft') renderPage();
  else {
    renderBar();
    if (state.versions) renderVersions();
  }
  return true;
}
function stamp() {
  const mark = $('.status__seal .seal');
  if (!mark) return;
  mark.classList.remove('is-stamping');
  void mark.offsetWidth;
  mark.classList.add('is-stamping');
}

/* ═══ Versions panel ════════════════════════════════════════════════════ */
function renderVersions() {
  const n = current();
  const list = $('#versions-list');
  const compared = state.compare !== 'draft' && state.against !== 'phone' ? state.against : -1;
  list.replaceChildren(
    h(
      'li',
      { class: 'version' },
      h('span', { class: 'version__mark version__mark--draft', 'aria-hidden': 'true' }),
      h('span', { class: 'version__when', text: 'Draft · now' }),
      h('span', { class: 'count', text: `${fmt(noteWords(n))} w` }),
    ),
    ...n.versions.map((v, i) =>
      h(
        'li',
        { class: `version${i === compared ? ' is-compared' : ''}` },
        h('span', { class: 'version__mark seal seal--small', 'aria-hidden': 'true' }),
        v.name ? h('span', { class: 'version__name', text: v.name }) : null,
        h('span', { class: 'version__when', text: `Sealed ${versionWhen(v)}` }),
        h('span', { class: 'count', text: `${fmt(versionWords(n, v))} w` }),
        h(
          'div',
          { class: 'version__actions' },
          h('button', {
            class: 'word-button',
            type: 'button',
            'data-version': String(i),
            'data-do': 'compare',
            'aria-pressed': String(i === compared && state.compare === 'changes'),
            'aria-label': `Compare the draft with ${v.name ? `“${v.name}”` : `the seal ${versionWhen(v)}`}`,
            text: 'Compare',
          }),
          h('button', {
            class: 'word-button',
            type: 'button',
            'data-version': String(i),
            'data-do': 'restore',
            'aria-label': `Restore ${v.name ? `“${v.name}”` : `the seal ${versionWhen(v)}`}`,
            text: 'Restore',
          }),
        ),
      ),
    ),
  );
  if (!n.versions.length) list.append(h('li', { class: 'versions__note', text: 'Not sealed yet. ⌘S seals the draft.' }));
}
// Side by side while the sheet keeps a reading width; over the page when it can't.
const MIN_SHEET = 480;
function fitVersions() {
  const page = $('#page');
  page.classList.toggle('versions-over', page.clientWidth - token('--eien-panel-w') < MIN_SHEET);
}
function setVersions(open) {
  state.versions = open;
  const panel = $('#versions');
  panel.hidden = !open;
  panel.inert = !open;
  fitVersions();
  $('#page').classList.toggle('has-versions', open);
  if (open) renderVersions();
  renderBar();
}
function bindVersions() {
  $('#versions-button').addEventListener('click', () => setVersions(!state.versions));
  $('#versions-close').addEventListener('click', () => {
    setVersions(false);
    $('#versions-button').focus();
  });
  $('#versions-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-do]');
    if (!b) return;
    const n = current();
    const i = Number(b.dataset.version);
    if (b.dataset.do === 'compare') {
      if (state.compare === 'changes' && state.against === i) setCompare('draft');
      else setCompare('changes', i);
      return $(`[data-do="compare"][data-version="${i}"]`)?.focus();
    }
    const v = n.versions[i];
    seal({ quiet: true }); // the draft is sealed first, so restoring is undoable
    n.body = clone(v.blocks);
    n.counted = bodyWords(n.body); // restoring isn't writing: today's tally stays
    state.compare = 'draft';
    state.against = 0;
    afterTextChange();
    renderPage();
    flash('Restored — the draft was sealed first', 7000);
    renderVersions();
  });
}

/* ═══ Status line: the colophon ═════════════════════════════════════════ */
function buildStatus() {
  const item = (id, extra = '', ...kids) => h('span', { class: `st-item ${extra}`, id }, ...kids);
  $('#status').replaceChildren(
    item('st-view'),
    item('st-words'),
    item('st-today'),
    item('st-sprint', 'st-item--optional'),
    h('span', { class: 'st-item status__seal' }, h('span', { class: 'seal seal--small', 'aria-hidden': 'true' }), h('span', { id: 'st-seal' })),
    item('st-zoom', 'st-item--optional', '110%'),
  );
}
function renderStatus() {
  const n = current();
  const view = $('#st-view');
  view.textContent = state.view !== 'live' && state.compare === 'draft' ? VIEW_NAMES[state.view] : '';
  view.hidden = !view.textContent;
  $('#st-words').textContent = `${fmt(noteWords(n))} words`;
  $('#st-today').textContent = `Today ${state.today >= 0 ? '+' : '−'}${fmt(Math.abs(state.today))}`;
  const m = Math.floor(state.sprint / 60);
  const s = String(state.sprint % 60).padStart(2, '0');
  $('#st-sprint').textContent = `Sprint ${m}:${s}`;
  const sealEl = $('#st-seal');
  const mark = $('.status__seal .seal');
  const msgOn = state.msg && Date.now() < state.msg.until;
  $('#status').classList.toggle('has-msg', !!msgOn);
  if (msgOn) {
    sealEl.textContent = state.msg.text;
    sealEl.className = 'status__msg';
  } else {
    sealEl.className = '';
    sealEl.textContent = n.versions.length ? `Sealed ${versionWhen(n.versions[0])}` : 'Not sealed yet';
  }
  mark.hidden = !n.versions.length;
}
function flash(text, ms = 4000) {
  state.msg = { text, until: Date.now() + ms };
  renderStatus();
  announce(text);
}
function announce(text) {
  const a = $('#announce');
  a.textContent = '';
  requestAnimationFrame(() => (a.textContent = text));
}
function renderFoot() {
  $('#vault-count').textContent = `${fmt(VAULT.notes + NOTES.length - BASE_NOTES)} notes · ${fmt(vaultWords())} words`;
}
const vaultWords = () => VAULT.words + NOTES.reduce((s, n) => s + (bodyWords(n.body) - n.counted0), 0);

/** After the open note's text changes: today's tally, the list's counts, the foot. */
function afterTextChange() {
  const n = current();
  const now = bodyWords(n.body);
  state.today += now - n.counted;
  n.counted = now;
  renderStatus();
  const row = $(`.note-row[data-id="${n.id}"]`);
  if (row) {
    const ctx = state.listCtx;
    $('.note-row__meta', row).textContent = ctx.book ? `${fmt(noteWords(n))} w` : n.when;
    $('.note-row__title', row).textContent = n.title || 'Untitled';
    row.classList.toggle('is-untitled', !n.title);
    const p = previewOf(n);
    const pv = $('.note-row__preview', row);
    pv.textContent = p || 'Empty';
    pv.classList.toggle('is-empty', !p);
  }
  if (state.listCtx && !state.query) $('#list-meta').textContent = listContext().meta;
  renderFoot();
  if (state.versions) {
    const draftCount = $('#versions-list .version .count');
    if (draftCount) draftCount.textContent = `${fmt(noteWords(n))} w`;
  }
}

function bindPage() {
  const page = $('#page');
  const sheet = $('#sheet');
  let last = null;
  // Controls fade out while typing, and come back when the pointer moves.
  page.addEventListener('pointermove', (e) => {
    if (last && Math.hypot(e.clientX - last.x, e.clientY - last.y) > 3) page.classList.remove('is-typing');
    last = { x: e.clientX, y: e.clientY };
  });
  sheet.addEventListener('keydown', (e) => {
    if (!e.metaKey && !e.ctrlKey && e.key.length === 1) page.classList.add('is-typing');
    if (e.target.classList.contains('title') && e.key === 'Enter') {
      e.preventDefault();
      const prose = $('.prose', sheet);
      prose?.focus();
    }
  });
  sheet.addEventListener('input', (e) => {
    const n = current();
    if (e.target.classList?.contains('title')) {
      n.title = e.target.textContent.replace(/\s+/g, ' ').trim();
      if (state.panes === 2) renderSidebar();
    } else if (e.target.closest('.prose')) {
      const prose = e.target.closest('.prose');
      n.body = readBlocks(prose);
      prose.classList.toggle('is-blank', !n.body.length && !prose.textContent.trim());
    } else return;
    afterTextChange();
  });
  sheet.addEventListener('paste', (e) => {
    if (!e.target.closest('[contenteditable="true"]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });
  sheet.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'conflict-compare') setCompare('changes', 'phone');
    if (action === 'keep-both') keepBoth();
  });

  for (const b of $$('[data-view]')) b.addEventListener('click', () => setView(b.dataset.view));
  $('#compare-button').addEventListener('click', cycleCompare);
  $('#seal-button').addEventListener('click', () => seal());
}

/* ═══ Notes: open, new, conflict ════════════════════════════════════════ */
function openNote(id) {
  if (state.view === 'source') {
    const pre = $('.source');
    if (pre) fromMarkdown(pre.innerText, current());
  }
  state.noteId = id;
  state.compare = 'draft';
  state.against = 0;
  state.msg = null;
  renderList();
  if (state.panes === 2) renderSidebar();
  renderPage();
  $('#scroll').scrollTop = 0;
  syncMockbar();
}
function newNote() {
  const f = state.listCtx?.folder || findFolder('scraps').folder;
  const n = {
    id: `new${NOTES.length}`,
    folder: f.id,
    title: '',
    words: 0,
    when: 'now',
    ago: 0,
    tags: [],
    body: [],
    versions: [],
    offset: 0,
    counted: 0,
    counted0: 0,
  };
  NOTES.push(n);
  f.order.push(n.id);
  if (f.count != null) f.count++;
  state.noteId = n.id;
  state.view = 'live';
  state.compare = 'draft';
  state.msg = null;
  renderSidebar();
  renderList();
  renderPage({ focus: 'title' });
}
let conflictBackup = null;
function keepBoth() {
  const n = byId('seventeen');
  const f = findFolder('scarf').folder;
  const copy = {
    id: 'seventeen-conflict',
    folder: 'scarf',
    title: 'Seventeen (conflict 2026-10-19 16-40)',
    words: noteWords(n),
    when: 'now',
    ago: 0,
    tags: [...n.tags],
    body: clone(n.body),
    versions: [],
    offset: n.offset,
    counted: bodyWords(n.body),
    counted0: bodyWords(n.body),
  };
  conflictBackup = clone(n.body);
  NOTES.push(copy);
  f.order.push(copy.id);
  n.body = clone(PHONE); // the file keeps the other device's text; yours is the sibling
  n.counted = bodyWords(n.body);
  state.conflict = false;
  state.compare = 'draft';
  renderList();
  renderSidebar();
  renderPage();
  syncMockbar();
  flash('Kept both — your copy is beside it', 7000);
}
function setConflict(on) {
  state.conflict = on;
  if (!on && conflictBackup) {
    const i = NOTES.findIndex((n) => n.id === 'seventeen-conflict');
    if (i >= 0) NOTES.splice(i, 1);
    const f = findFolder('scarf').folder;
    f.order = f.order.filter((id) => id !== 'seventeen-conflict');
    byId('seventeen').body = conflictBackup;
    conflictBackup = null;
  }
  if (on) {
    state.noteId = 'seventeen';
    state.compare = 'draft';
  }
  renderList();
  renderSidebar();
  renderPage();
  syncMockbar();
}
const EMPTY_FOLDER = { id: 'untitled-folder', name: 'Untitled folder' };
function setEmpty(on) {
  state.empty = on;
  const fic = FOLDERS[0];
  if (on) {
    EMPTY_FOLDER.order = [];
    fic.children.push(EMPTY_FOLDER);
    state.open.add('f:fic');
    state.sel = 'f:untitled-folder';
    if (state.panes === 2) setPanes(3);
  } else {
    fic.children = fic.children.filter((f) => f !== EMPTY_FOLDER);
    for (let i = NOTES.length - 1; i >= 0; i--) if (NOTES[i].folder === EMPTY_FOLDER.id) NOTES.splice(i, 1);
    if (!byId(state.noteId)) state.noteId = 'seventeen';
    state.sel = 'f:scarf';
  }
  state.query = '';
  for (const f of $$('[data-search]')) f.value = '';
  renderSidebar();
  renderList();
  renderPage();
  syncMockbar();
}

/* ═══ Panes: collapse, two-pane, resize ═════════════════════════════════ */
function applyLayout() {
  const win = $('#window');
  const two = state.panes === 2;
  const sbOpen = two ? state.sbW2 : state.sbW;
  win.style.setProperty('--sb', `${state.sidebar ? sbOpen : token('--eien-space-7')}px`);
  win.style.setProperty('--ls', `${!two && state.list ? state.lsW : 0}px`);
  win.style.setProperty('--sb-open', `${sbOpen}px`);
  win.style.setProperty('--ls-open', `${state.lsW}px`);
  win.classList.toggle('no-sidebar', !state.sidebar);
  win.classList.toggle('no-list', !state.list);
  win.classList.toggle('two-panes', two);
  $('#list').inert = two || !state.list;
  for (const r of $$('.resizer')) {
    const w = r.dataset.resize === 'sidebar' ? sbOpen : state.lsW;
    r.setAttribute('aria-valuenow', String(Math.round(w)));
  }
  renderBar();
}
function toggleSidebar() {
  state.sidebar = !state.sidebar;
  applyLayout();
  if (state.sidebar) $('.sidebar__head .seal-button').focus({ preventScroll: true });
}
function toggleList() {
  if (state.panes === 2) return;
  state.list = !state.list;
  applyLayout();
}
function setPanes(p) {
  state.panes = p;
  if (p === 2) state.open.add(`f:${byId(state.noteId).folder}`);
  applyLayout();
  renderSidebar();
  renderList();
  syncMockbar();
}
const LIMITS = { sidebar: [200, 420], sidebar2: [220, 520], list: [260, 480] };
function bindResizers() {
  const win = $('#window');
  for (const r of $$('.resizer')) {
    const which = () => (r.dataset.resize === 'sidebar' ? (state.panes === 2 ? 'sbW2' : 'sbW') : 'lsW');
    const limits = () => LIMITS[r.dataset.resize === 'sidebar' ? (state.panes === 2 ? 'sidebar2' : 'sidebar') : 'list'];
    const set = (w) => {
      const [lo, hi] = limits();
      state[which()] = Math.max(lo, Math.min(hi, w));
      applyLayout();
    };
    let start = null;
    r.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      start = { x: e.clientX, w: state[which()] };
      r.setPointerCapture(e.pointerId);
      r.classList.add('is-dragging');
      win.classList.add('is-resizing');
    });
    r.addEventListener('pointermove', (e) => start && set(start.w + e.clientX - start.x));
    const end = () => {
      start = null;
      r.classList.remove('is-dragging');
      win.classList.remove('is-resizing');
    };
    r.addEventListener('pointerup', end);
    r.addEventListener('pointercancel', end);
    r.addEventListener('keydown', (e) => {
      const step = token('--eien-space-4');
      if (e.key === 'ArrowLeft') set(state[which()] - step);
      else if (e.key === 'ArrowRight') set(state[which()] + step);
      else return;
      e.preventDefault();
    });
    r.setAttribute('aria-valuemin', String(limits()[0]));
    r.setAttribute('aria-valuemax', String(limits()[1]));
  }
}

/* ═══ Theme ═════════════════════════════════════════════════════════════ */
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
function setTheme(theme) {
  state.theme = theme;
  if (theme === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  syncMockbar();
}
const effectiveTheme = () => (state.theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : state.theme);

/* ═══ Text face ═════════════════════════════════════════════════════════ */
// The writer's choice of text face (tokens.css, data-face). Kept across visits and mockups.
const FACE_KEY = 'eien-mockup-face';
const FACES = ['newsreader', 'literata', 'plex-sans', 'archivo'];
function savedFace() {
  try {
    const face = localStorage.getItem(FACE_KEY);
    return FACES.includes(face) ? face : 'newsreader';
  } catch {
    return 'newsreader';
  }
}
function setFace(face) {
  state.face = face;
  document.documentElement.dataset.face = face;
  try {
    localStorage.setItem(FACE_KEY, face);
  } catch {
    // Private windows may refuse storage; the choice still holds for this visit.
  }
  syncMockbar();
}

/* ═══ Mockup bar ════════════════════════════════════════════════════════ */
function syncMockbar() {
  const pressed = {
    theme: state.theme,
    face: state.face,
    panes: String(state.panes),
    compare: state.compare,
  };
  for (const b of $$('[data-mock]')) {
    const kind = b.dataset.mock;
    const on = kind === 'conflict' ? state.conflict : kind === 'empty' ? state.empty : pressed[kind] === b.dataset.value;
    b.setAttribute('aria-pressed', String(on));
  }
  for (const b of $$('[data-theme-pick]')) b.setAttribute('aria-pressed', String(b.dataset.themePick === effectiveTheme()));
  for (const b of $$('[data-panes-pick]')) b.setAttribute('aria-pressed', String(Number(b.dataset.panesPick) === state.panes));
}
function bindMockbar() {
  for (const b of $$('[data-mock]')) {
    b.addEventListener('click', () => {
      const { mock, value } = b.dataset;
      if (mock === 'theme') setTheme(value);
      if (mock === 'face') setFace(value);
      if (mock === 'panes') setPanes(Number(value));
      if (mock === 'compare') {
        if (!current().versions.length) openNote('seventeen');
        setCompare(value);
      }
      if (mock === 'conflict') setConflict(!state.conflict);
      if (mock === 'empty') setEmpty(!state.empty);
    });
  }
  for (const b of $$('[data-theme-pick]')) b.addEventListener('click', () => setTheme(b.dataset.themePick));
  for (const b of $$('[data-panes-pick]')) b.addEventListener('click', () => setPanes(Number(b.dataset.panesPick)));
  darkQuery.addEventListener('change', syncMockbar);
}

/* ═══ Keyboard ══════════════════════════════════════════════════════════ */
function focusPane(n) {
  if (n === 1) {
    if (!state.sidebar) toggleSidebar();
    const item = $('#tree-root [role="treeitem"][aria-selected="true"]') || $('#tree-root [role="treeitem"][tabindex="0"]');
    return focusTreeItem(item);
  }
  if (n === 2 && state.panes === 3) {
    if (!state.list) toggleList();
    return $('#rows .note-row[tabindex="0"]')?.focus();
  }
  const prose = $('#sheet .prose[contenteditable="true"], #sheet .source, #sheet .prose');
  prose?.focus();
}
function bindKeys() {
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && !e.altKey) {
      const run = {
        KeyS: () => seal(),
        KeyD: () => e.shiftKey && cycleCompare(),
        Backslash: () => (e.shiftKey ? toggleList() : toggleSidebar()),
        KeyE: () => cycleView(),
        Digit1: () => focusPane(1),
        Digit2: () => focusPane(2),
        Digit3: () => focusPane(3),
      }[e.code];
      if (run && (e.code !== 'KeyD' || e.shiftKey)) {
        e.preventDefault();
        run();
      }
      return;
    }
    // Typing in Changes or Sealed returns to the draft first (spec §9), and the key lands there.
    const typing = e.key.length === 1 && !e.altKey;
    const inField = e.target.closest?.('input, textarea, button, [contenteditable="true"], [role="treeitem"], [role="option"], [role="menu"]');
    if (state.compare !== 'draft' && typing && !inField) {
      e.preventDefault();
      setCompare('draft');
      placeCaretAtEnd($('#sheet .prose'));
      document.execCommand('insertText', false, e.key);
    }
    if (e.key === 'Escape' && state.versions && $('#versions').contains(document.activeElement)) {
      setVersions(false);
      $('#versions-button').focus();
    }
  });
  for (const field of $$('[data-search]')) {
    field.addEventListener('input', () => setQuery(field.value));
    field.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setQuery('');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusPane(state.panes === 2 ? 1 : 2);
      }
    });
  }
  for (const b of $$('[data-action="toggle-sidebar"]')) b.addEventListener('click', toggleSidebar);
  $('#bar-list').addEventListener('click', toggleList);
}

/* ═══ Start ═════════════════════════════════════════════════════════════ */
const BASE_NOTES = NOTES.length;
for (const n of NOTES) n.counted0 = n.counted;

state.face = savedFace();
document.documentElement.dataset.face = state.face;
buildStatus();
bindSidebar();
bindList();
bindPage();
bindVersions();
bindResizers();
bindMockbar();
bindKeys();
applyLayout();
renderSidebar();
renderList();
renderPage();
syncMockbar();

new ResizeObserver(fitVersions).observe($('#page'));

// The sprint counts down; relative times ("2h ago") stay true.
setInterval(() => {
  if (state.sprint > 0) state.sprint--;
  renderStatus();
}, 1000);
