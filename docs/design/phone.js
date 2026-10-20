/* Eien — the phone layout mockup (phone.html).
   Three phones lie on the desk. Each walks the whole flow on its own —
   contents → index → page and back, the page's controls behind ⋯ — and keeps
   its own copy of the vault, so what you do on one never changes another.
   Plain JavaScript, no libraries, no network. */

(() => {
  'use strict';

  /* ── The vault: Ink & Ash ───────────────────────────────────────────── */

  // Seventeen (iii of A Mended Scarf): the draft as it stands. `***` is a scene break.
  const SEVENTEEN = [
    '“Look,” he begins more softly. “I’m not going to let you ruin the mission when the only thing on your mind is this damn scarf. If you want it back so badly, hold it still.”',
    'It takes her a minute to collect herself. Then, she takes the end he’s holding out. The one that isn’t split.',
    'He drapes the broken one across his legs a moment later; threads the needle in; and starts.',
    '***',
    'She watches as he mends the seams. She’s only known him for the merciless work, not the delicate kind.',
    'The stitches are neat and as he works his way through, they each hold taut.',
    'The welling in her eyes has faded. The tension in her shoulders subsides.',
    'Her eyes drift idly up to his face; then the hair.',
    '“What are you staring at?”',
    'The break in silence surprises her.',
    '“You’re greying,” she replies honestly.',
    'It’s the one time he bothers to pause. “Are you trying to pick a fight?”',
    '“No. You asked what I was looking at.”',
    'He doesn’t reply.',
    '***',
    'It takes a long time—to the point the fire begins to dim—but he doesn’t hurry.',
    'When he’s done, he bites off the thread with his teeth. Checks it once; twice; and holds it out.',
    'She takes it. The stitches are almost invisible.',
  ];

  // A version is another version with a few phrases swapped.
  const swap = (blocks, pairs) =>
    blocks.map((b) => pairs.reduce((text, [from, to]) => text.replace(from, to), b));

  // Its last seal, 2h ago: the four places the brief lists.
  const SEALED_2H = swap(SEVENTEEN, [
    ['a minute to collect', 'a long minute to collect'],
    ['She watches as he mends the seams.', 'She watches him work.'],
    ['The welling in her eyes has faded. ', ''],
    ['It’s the one time he bothers to pause.', 'He pauses, just once.'],
  ]);
  // Named the night before: "before the rewrite".
  const BEFORE_REWRITE = swap(SEALED_2H, [
    ['Then, she takes the end he’s holding out. The one that isn’t split.', 'Then she takes the end he’s holding out, the one that isn’t split, and holds it still the way he told her to.'],
    ['He doesn’t reply.', 'He doesn’t reply. He doesn’t look up, either.'],
    ['they each hold taut.', 'they each hold taut. Somewhere behind them the horses shift and settle, and the fire spits once and goes quiet.'],
  ]);
  // The first seal, before the last scene was written.
  const SEALED_OCT_12 = BEFORE_REWRITE.slice(0, BEFORE_REWRITE.lastIndexOf('***'));

  // Notes: title, folder, tags, when last edited (age in minutes sorts it),
  // the whole note's word count, and its text (the opening, for most).
  const NOTES = {
    seventeen: {
      title: 'Seventeen', folder: 'scarf', tags: ['fic/aot', 'draft'], date: '2h', age: 120,
      words: 1204, today: 809, fm: '01JB2X4Q7Z', text: SEVENTEEN,
      versions: [
        { when: '2h ago', text: SEALED_2H },
        { when: 'yesterday 23:40', name: 'before the rewrite', text: BEFORE_REWRITE },
        { when: 'Oct 12', text: SEALED_OCT_12 },
      ],
    },
    tear: {
      title: 'The Tear', folder: 'scarf', tags: ['fic/aot', 'posted'], date: 'Oct 12', age: 10080, words: 2140,
      text: ['The scarf catches on the gate latch, and she hears it go before she feels it.', 'Red wool, older than the gate. She doesn’t look down until the others have gone ahead.'],
    },
    needle: {
      title: 'Needle and Thread', folder: 'scarf', tags: ['fic/aot', 'posted'], date: 'yesterday', age: 1500, words: 1987,
      text: ['He finds the sewing kit in the quartermaster’s crate, between the flints and the salt.', 'Nobody in the squad admits to knowing how to use it.'],
    },
    ash: {
      title: 'Ash on the Wind', folder: 'scarf', tags: ['fic/aot', 'draft'], date: 'Oct 16', age: 4400, words: 612, draft: true,
      text: ['The pyres burn through the night. Nobody says the names out loud.', 'She counts them anyway, under her breath, and loses her place at forty.'],
    },
    untitled: { title: '', folder: 'scarf', tags: [], date: 'Oct 17', age: 3000, words: 0, text: [], versions: [] },

    outline: {
      title: 'A Mended Scarf — outline', folder: 'fic', tags: ['fic/aot', 'ideas'], date: 'yesterday', age: 1450, words: 488, pinned: true,
      text: ['i. The tear at the gate. She hears it go before she feels it.', 'ii. The kit in the quartermaster’s crate. Needle, thread, and no one who can use them.', 'iii. Seventeen. He mends it; she watches. The greying.', 'iv. Ash on the wind. Nobody says the names.', 'v. Who keeps what. Open.'],
    },
    smallhours: {
      title: 'Small Hours', folder: 'oneshots', tags: ['fic/aot', 'posted'], date: 'Sep 30', age: 27000, words: 3410,
      text: ['The tea goes cold twice before either of them says anything.'],
    },
    rain: {
      title: 'Rain at the Old Gate', folder: 'oneshots', tags: ['fic/aot', 'posted'], date: 'Sep 14', age: 50000, words: 2760,
      text: ['It rains the day they go back, which feels like a kindness.'],
    },
    salt: {
      title: 'Salt', folder: 'oneshots', tags: ['fic/aot', 'draft'], date: 'Oct 15', age: 5800, words: 930, draft: true,
      text: ['The sea is bigger than anyone told her, and it doesn’t care that she came.'],
    },

    voice: {
      title: 'Character voice sheet', folder: 'characters', tags: ['fic/aot'], date: 'Oct 9', age: 14400, words: 1140, pinned: true,
      text: ['The Captain: clipped, exact, never wastes a word. Swears when he’s worried, not when he’s angry.', 'Her: says less than she means. Answers questions with what she’s going to do about them.'],
    },
    captain: {
      title: 'The Captain — habits and tells', folder: 'characters', tags: ['fic/aot', 'research'], date: 'yesterday', age: 1600, words: 640,
      text: ['Cleans when he can’t sleep. Holds a cup by the rim. Looks at hands before faces.', 'Never says thank you; fixes the thing instead.'],
    },
    tics: {
      title: 'Dialogue tics', folder: 'characters', tags: ['fic/aot'], date: 'Oct 7', age: 17300, words: 184,
      text: ['Tch. Short questions answered with shorter ones. She says “fine” when it isn’t.'],
    },
    trost: {
      title: 'Trost, after', folder: 'places', tags: ['research'], date: 'Oct 3', age: 23000, words: 830,
      text: ['Smoke over the inner gate for three days. The bells stopped ringing on the second.'],
    },
    supply: {
      title: 'Supply routes (map notes)', folder: 'places', tags: ['research'], date: 'Sep 28', age: 30000, words: 412,
      text: ['North road floods in spring; the crossing at the mill is the only dry way in.'],
    },
    symbolism: {
      title: 'Scarf symbolism', folder: 'research', tags: ['research', 'ideas'], date: '6h', age: 360, words: 356,
      text: ['Red wool: the colour holds even when the threads don’t. Mended, not replaced.', 'Who gave it, who keeps it, who fixes it — three different kinds of love.'],
    },
    remains: {
      title: 'Reading: The Remains of the Day', folder: 'reading', tags: ['research'], date: 'Oct 1', age: 26000, words: 518,
      text: ['Restraint as the whole engine. Stevens never says it, and the not-saying is the story.'],
    },
    lines: {
      title: 'Lines I want to use', folder: 'scraps', tags: ['ideas'], date: '5h', age: 300, words: 228,
      text: ['“You don’t get to decide what I keep.”', 'Something about stitches being a kind of promise.'],
    },
    winter: {
      title: 'Ideas — winter arc', folder: 'scraps', tags: ['ideas', 'draft'], date: 'Oct 16', age: 4300, words: 301,
      text: ['Snowed in at the outpost. Short days, long chapters. The scarf has to come back.'],
    },
    checklist: {
      title: 'AO3 posting checklist', folder: 'checklists', tags: ['todo'], date: 'Oct 11', age: 11500, words: 96, pinned: true,
      text: ['- [x] Title, summary and notes', '- [x] Tags: fandom, relationships, characters', '- [x] Archive warnings and rating', '- [x] Chapter number and chapter title', '- [ ] Copy for AO3, paste into the HTML box', '- [ ] Preview: the scene breaks', '- [ ] Post, then add #posted'],
    },
  };

  // Beneath the Walls: a fourteen-chapter book.
  const WALLS = [
    ['Roll Call', 'Forty names called at dawn; thirty-one answer.', 3120],
    ['The Inner Gate', 'The gate opens a hand’s width and the whole street holds its breath.', 2875],
    ['Rations', 'Half a loaf, a strip of salt pork, and a lecture about both.', 2410],
    ['What the Wall Hears', 'Stone keeps every sound you give it, the old engineer says.', 2990],
    ['Lamplight', 'He reads the reports by a lamp turned down to almost nothing.', 1860],
    ['The Long Way Round', 'They take the river road because the short one is full of ghosts.', 3305],
    ['Second Watch', 'Nobody sleeps on second watch; they just stop talking.', 2240],
    ['Ironworks', 'Sparks, and the smell of hot metal, and a blade that isn’t ready.', 2715],
    ['Letters Home', 'She writes three and sends none.', 1590],
    ['Below Stohess', 'The tunnels are older than the city above them.', 3480],
    ['The Underground', 'Daylight here is a rumour, sold by the hour.', 2960],
    ['Old Debts', 'A man in a doorway knows his name, which is worse than a knife.', 2530],
    ['Daylight', 'The first sun in a week, and nobody trusts it.', 2105],
    ['Above', 'The climb, and what waits at the top.', 840],
  ];
  WALLS.forEach(([title, line, words], i) => {
    const draft = i === WALLS.length - 1;
    NOTES[`walls${i + 1}`] = {
      title, folder: 'walls', tags: ['fic/aot/canon-divergence', draft ? 'draft' : 'posted'],
      date: draft ? 'Oct 14' : `Aug ${i + 2}`, age: draft ? 7000 : 90000 - i * 1000, words, draft, text: [line],
    };
  });

  // Every note starts sealed as it stands, unless it says otherwise; its front
  // matter gets an id at its first seal (spec §2).
  Object.entries(NOTES).forEach(([id, n], i) => {
    n.versions ??= [{ when: /h$/.test(n.date) ? `${n.date} ago` : n.date, text: [...n.text] }];
    if (n.versions.length) n.fm ??= `01JB${(i * 7919 + 4096).toString(36).toUpperCase().padStart(6, '0')}`;
  });

  const ORDER = {
    scarf: ['tear', 'needle', 'seventeen', 'ash', 'untitled'],
    walls: WALLS.map((_, i) => `walls${i + 1}`),
  };

  const LIBRARY = [
    { id: 'all', name: 'All Notes', count: 312 },
    { id: 'pinned', name: 'Pinned', count: 3, pinned: true },
  ];
  const FOLDERS = [
    { id: 'fic', name: 'Fic', count: 41, children: [
      { id: 'scarf', name: 'A Mended Scarf', count: 5, book: true },
      { id: 'walls', name: 'Beneath the Walls', count: 14, book: true },
      { id: 'oneshots', name: 'One-shots', count: 22 },
    ] },
    { id: 'notes', name: 'Notes', count: 198, children: [
      { id: 'characters', name: 'Characters', count: 37 },
      { id: 'places', name: 'Places', count: 19 },
      { id: 'research', name: 'Research', count: 64 },
      { id: 'scraps', name: 'Scraps', count: 78 },
    ] },
    { id: 'checklists', name: 'Checklists', count: 12 },
    { id: 'reading', name: 'Reading', count: 61 },
  ];
  const TAGS = [
    { id: 'fic', name: 'fic', count: 41, children: [
      { id: 'fic/aot', name: 'aot', count: 33, children: [
        { id: 'fic/aot/canon-divergence', name: 'canon-divergence', count: 9 },
      ] },
    ] },
    { id: 'draft', name: 'draft', count: 14 },
    { id: 'posted', name: 'posted', count: 22 },
    { id: 'ideas', name: 'ideas', count: 57 },
    { id: 'research', name: 'research', count: 64 },
    { id: 'todo', name: 'todo', count: 8 },
  ];
  const OPEN_AT_START = ['folder:fic', 'tag:fic'];

  const LONG_PRESS_MS = 500;
  const FLASH_MS = 2400;

  /* ── Small helpers ──────────────────────────────────────────────────── */

  // h('p', { class: 'x', text: 'y' }, child, …) — builds an element; text is never parsed as HTML.
  function h(tag, props = {}, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value == null || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key === 'style') el.style.cssText = value;
      else el.setAttribute(key, value === true ? '' : value);
    }
    el.append(...children.flat().filter((c) => c != null && c !== false));
    return el;
  }

  const ROMAN = [['m', 1000], ['cm', 900], ['d', 500], ['cd', 400], ['c', 100], ['xc', 90], ['l', 50], ['xl', 40], ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1]];
  function roman(n) {
    let out = '';
    for (const [glyph, value] of ROMAN) for (; n >= value; n -= value) out += glyph;
    return out;
  }

  const fmt = (n) => n.toLocaleString('en-US');
  const TASK = /^- \[([ x])\] (.*)$/;
  const plain = (block) => block.replace(TASK, '$2');
  const countWords = (blocks) =>
    blocks.reduce((sum, b) => (b === '***' ? sum : sum + plain(b).split(/\s+/).filter(Boolean).length), 0);
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  const signed = (n) => (n < 0 ? `−${fmt(-n)}` : `+${fmt(n)}`);
  const sealMark = (stamped) => h('span', { class: `seal seal--small${stamped ? ' is-stamped' : ''}`, 'aria-hidden': 'true' });

  function findIn(items, id, trail = []) {
    for (const item of items) {
      const here = [...trail, item];
      if (item.id === id) return here;
      const found = item.children && findIn(item.children, id, here);
      if (found) return found;
    }
    return null;
  }

  // Word-level compare: the longest common run of words, then what was struck and what was added.
  function tokens(blocks) {
    const out = [];
    blocks.forEach((b, i) => {
      if (i) out.push('\n');
      if (b === '***') out.push('***');
      else out.push(...b.split(/\s+/).filter(Boolean));
    });
    return out;
  }
  // Walks back from the end, so an added sentence groups whole ("The welling … faded.")
  // and, inside a change, what was struck reads before what replaced it.
  function diff(a, b) {
    const n = a.length;
    const m = b.length;
    const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = 1; i <= n; i++)
      for (let j = 1; j <= m; j++)
        lcs[i][j] = a[i - 1] === b[j - 1] ? lcs[i - 1][j - 1] + 1 : Math.max(lcs[i - 1][j], lcs[i][j - 1]);
    const ops = [];
    let i = n;
    let j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) (j--, ops.push(['=', a[--i]]));
      else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) ops.push(['+', b[--j]]);
      else ops.push(['-', a[--i]]);
    }
    return ops.reverse();
  }

  /* ── Theme: System / Day / Night ─────────────────────────────────────── */

  const root = document.documentElement;
  const darkQuery = matchMedia('(prefers-color-scheme: dark)');

  function setTheme(choice) {
    if (choice === 'system') delete root.dataset.theme;
    else root.dataset.theme = choice === 'night' ? 'dark' : 'light';
    syncTheme();
  }
  function syncTheme() {
    const choice = { dark: 'night', light: 'day' }[root.dataset.theme] || 'system';
    const night = root.dataset.theme ? root.dataset.theme === 'dark' : darkQuery.matches;
    document.querySelectorAll('[data-theme-choice]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.themeChoice === choice)));
    document.querySelectorAll('[data-theme-pick]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.themePick === (night ? 'night' : 'day'))));
  }
  darkQuery.addEventListener('change', syncTheme);
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-theme-choice]');
    const pick = e.target.closest('[data-theme-pick]');
    if (choice) setTheme(choice.dataset.themeChoice);
    if (pick) setTheme(pick.dataset.themePick);
  });

  /* ── Text face: Newsreader / Literata / Plex Sans / Archivo ──────────── */
  // The writer's choice (tokens.css, data-face). Kept across visits and mockups.

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
  function applyFace(face) {
    root.dataset.face = face;
    document.querySelectorAll('[data-face-choice]').forEach((b) =>
      b.setAttribute('aria-pressed', String(b.dataset.faceChoice === face)));
  }
  document.addEventListener('click', (e) => {
    const choice = e.target.closest('[data-face-choice]');
    if (!choice) return;
    applyFace(choice.dataset.faceChoice);
    try {
      localStorage.setItem(FACE_KEY, choice.dataset.faceChoice);
    } catch {
      // Private windows may refuse storage; the choice still holds for this visit.
    }
  });
  root.dataset.face = savedFace();

  /* ── One phone ──────────────────────────────────────────────────────── */

  const TEMPLATE = document.getElementById('phone-template');
  const STACK = ['tree', 'list', 'page'];
  let uid = 0;

  function makePhone(el, start) {
    el.append(TEMPLATE.content.cloneNode(true));
    el.classList.add('is-still');
    const q = (sel) => el.querySelector(sel);
    const qa = (sel) => [...el.querySelectorAll(sel)];

    const notes = structuredClone(NOTES);
    const order = structuredClone(ORDER);
    // How many words of each note's opening are on the page now: the colophon counts from there.
    for (const n of Object.values(notes)) n.base = countWords(n.text);

    const st = {
      view: start,
      list: { kind: 'folder', id: 'scarf' },
      sort: null, // null = the list's own default
      noteId: 'seventeen',
      reordering: false,
      mode: 'live', // live · source · reading
      compare: 'draft', // draft · changes · sealed
      baseline: 0, // which seal Compare looks at
      versionsOpen: false,
      sheet: null,
      quotes: 'curly',
      open: new Set(OPEN_AT_START),
      made: 0,
    };

    const view = { tree: q('.view--tree'), list: q('.view--list'), page: q('.view--page') };
    const views = q('.views');
    const nav = q('.tree-scroll');
    const index = q('.index');
    const prose = q('.prose');
    const title = q('.paper__title');
    const colophon = q('.page-foot__colophon');
    const sheet = q('.bottom-sheet');
    const scrim = q('.scrim');
    const sayBox = q('[data-say]');
    let sheetOpener = null;
    let flashTimer = 0;
    let swallowClick = false;

    const note = () => notes[st.noteId];
    const wordsOf = (n, text = n.text) => Math.max(0, n.words + countWords(text) - n.base);
    const say = (words) => {
      sayBox.textContent = '';
      requestAnimationFrame(() => (sayBox.textContent = words));
    };

    /* Moving between the three panes */

    function go(name, focusTarget) {
      const hadFocus = el.contains(document.activeElement);
      const depth = STACK.indexOf(name);
      STACK.forEach((v, i) => {
        view[v].classList.toggle('is-current', i === depth);
        view[v].classList.toggle('is-under', i < depth);
        view[v].inert = i !== depth;
      });
      st.view = name;
      if (hadFocus && focusTarget) focusTarget.focus({ preventScroll: true });
    }

    function openList(kind, id, query) {
      st.list = { kind, id, query };
      st.sort = null;
      st.reordering = false;
      renderTree();
      renderList();
      q('.list-scroll').scrollTop = 0;
      go('list', q('.view--list .bar__back'));
    }

    function openNote(id) {
      if (id !== st.noteId) Object.assign(st, { mode: 'live', compare: 'draft', baseline: 0, versionsOpen: false });
      st.noteId = id;
      renderList();
      renderPage();
      q('.page-scroll').scrollTop = 0;
      go('page', q('.view--page .bar__back'));
    }

    function back() {
      if (st.view === 'page') {
        renderList();
        go('list', q(`.index-open[data-id="${st.noteId}"]`) || q('.view--list .bar__back'));
      } else if (st.view === 'list') {
        if (st.reordering) endReorder();
        renderTree();
        go('tree', q('.tree-row.is-selected .tree-open') || q('.home'));
      }
    }

    /* I. Contents */

    function renderTree() {
      nav.replaceChildren(
        treeSection('Library', LIBRARY.map((item) => treeRow(item, 0, 'library'))),
        treeSection('Folders', walk(FOLDERS, 'folder')),
        treeSection('Tags', walk(TAGS, 'tag')),
      );
    }
    function walk(items, kind, depth = 0) {
      return items.flatMap((item) => [
        treeRow(item, depth, kind),
        ...(item.children && st.open.has(`${kind}:${item.id}`) ? walk(item.children, kind, depth + 1) : []),
      ]);
    }
    function treeSection(label, rows) {
      const id = `p${uid++}`;
      return h('section', { class: 'tree-section', 'aria-labelledby': id },
        h('h3', { class: 'label tree-label', id, text: label }),
        h('ul', { class: 'tree', role: 'list' }, rows));
    }
    function treeRow(item, depth, kind) {
      const key = `${kind}:${item.id}`;
      const selected = st.list.kind === kind && st.list.id === item.id;
      const open = st.open.has(key);
      const name = kind === 'tag' ? [h('span', { class: 'tree-name__hash', text: '#' }), item.name] : [item.name];
      return h('li', { class: `tree-row${selected ? ' is-selected' : ''}`, style: `--depth:${depth}` },
        item.children && h('button', {
          class: 'tree-twist', type: 'button', 'data-act': 'twist', 'data-key': key,
          'aria-expanded': String(open), 'aria-label': `${open ? 'Hide' : 'Show'} what’s inside ${kind === 'tag' ? '#' + item.id : item.name}`,
        }, open ? '▾' : '▸'),
        item.pinned && h('span', { class: 'ribbon', 'aria-hidden': 'true' }),
        h('button', {
          class: 'tree-open', type: 'button', 'data-act': 'open-list', 'data-kind': kind, 'data-id': item.id,
          'aria-current': selected ? 'true' : null,
        },
          h('span', { class: 'tree-name' }, name),
          item.book && h('span', { class: 'label label--mark', text: 'Book' }),
          h('span', { class: 'leader', 'aria-hidden': 'true' }),
          h('span', { class: 'count', text: fmt(item.count) })));
    }

    /* II. Index */

    function listModel() {
      const { kind, id, query } = st.list;
      const all = Object.keys(notes);
      const made = (ids) => ids.filter((x) => x.startsWith('made-')).length;
      if (kind === 'search') {
        const needle = query.toLowerCase();
        const ids = all.filter((x) => `${notes[x].title} ${notes[x].text.join(' ')}`.toLowerCase().includes(needle));
        return { kind, title: `“${query}”`, meta: `${ids.length} found · search`, ids, count: ids.length };
      }
      if (kind === 'library') {
        const ids = id === 'pinned' ? all.filter((x) => notes[x].pinned) : all;
        const item = LIBRARY.find((l) => l.id === id);
        return { kind, title: item.name, meta: `${fmt(item.count + made(ids))} notes`, ids, count: item.count + made(ids) };
      }
      if (kind === 'tag') {
        const ids = all.filter((x) => notes[x].tags.some((t) => t === id || t.startsWith(`${id}/`)));
        const item = findIn(TAGS, id).at(-1);
        return { kind, title: `#${id}`, meta: `${item.count + made(ids)} notes · tag`, ids, count: item.count + made(ids) };
      }
      const path = findIn(FOLDERS, id);
      const folder = path.at(-1);
      const inside = new Set([id, ...(folder.children || []).map((c) => c.id)]);
      const ids = folder.book ? order[id] : all.filter((x) => inside.has(notes[x].folder));
      const count = folder.book ? ids.length : folder.count + made(ids);
      return { kind, title: folder.name, meta: `${count} notes${folder.book ? ' · book' : ''}`, ids, count, book: !!folder.book, folder: id };
    }

    const SORTS = { book: ['order', 'edited', 'title'], plain: ['edited', 'title'] };
    const SORT_SAYS = { order: 'book order', edited: 'last edited', title: 'title' };

    function renderList() {
      const m = listModel();
      const sorts = m.book ? SORTS.book : SORTS.plain;
      const sort = st.sort ?? sorts[0];
      let ids = [...m.ids];
      if (sort === 'edited') ids.sort((a, b) => notes[a].age - notes[b].age);
      if (sort === 'title') ids.sort((a, b) => (notes[a].title || '￿').localeCompare(notes[b].title || '￿'));

      q('.view--list .bar__back').textContent = '← Ink & Ash';
      q('.list-head__title').textContent = m.title;
      q('.list-head__meta').textContent = m.meta;
      const sortButton = q('[data-act="sort"]');
      sortButton.textContent = sort;
      sortButton.disabled = st.reordering;
      sortButton.setAttribute('aria-label', `Sort: ${SORT_SAYS[sort]}. Change sort`);

      index.className = `index${m.book ? '' : ' index--plain'}${st.reordering ? ' is-reordering' : ''}`;
      index.replaceChildren(...ids.map((id) => indexRow(id, m)));
      if (!ids.length) index.append(h('li', { class: 'index-empty', text: m.kind === 'search' ? `Nothing in Ink & Ash says ${m.title}.` : 'Nothing here yet.' }));
      q('.index-end').textContent = ids.length && ids.length < m.count ? `${ids.length} of ${m.count} in this mockup` : '';

      const total = m.book ? ids.reduce((sum, id) => sum + wordsOf(notes[id]), 0) : 0;
      q('.list-foot__total').textContent = m.book ? `${fmt(total)} words in the book` : '';
      q('.list-foot__total').hidden = st.reordering;
      q('.list-foot__hint').hidden = !st.reordering;
      q('[data-act="new-note"]').hidden = st.reordering;
      q('[data-act="done-reorder"]').hidden = !st.reordering;
    }

    function indexRow(id, m) {
      const n = notes[id];
      const chapter = m.book ? order[m.folder].indexOf(id) + 1 : 0;
      const selected = id === st.noteId;
      const name = n.title || '(untitled)';
      const preview = n.text.map(plain).filter((b) => b !== '***').join(' ');
      return h('li', { class: `index-item${selected ? ' is-selected' : ''}`, 'data-id': id },
        h('button', {
          class: 'index-open', type: 'button', 'data-act': 'open-note', 'data-id': id,
          'aria-current': selected ? 'true' : null,
          'aria-keyshortcuts': m.book ? 'Shift+F10 Alt+ArrowUp Alt+ArrowDown' : null,
          'aria-description': m.book ? 'Long-press or Shift+F10 to reorder the chapters.' : null,
        },
          m.book && h('span', { class: 'ordinal', text: roman(chapter) }),
          h('span', { class: `index-title${n.title ? '' : ' is-untitled'}` },
            n.pinned && h('span', { class: 'ribbon', role: 'img', 'aria-label': 'pinned' }),
            h('span', { class: 'index-title__text', text: name }),
            n.draft && h('span', { class: 'label label--mark', text: 'Draft' })),
          h('span', { class: 'count index-count', text: m.book ? `${fmt(wordsOf(n))} w` : n.date }),
          h('span', { class: `index-preview${preview ? '' : ' is-empty'}`, text: preview || 'Nothing written yet' })),
        st.reordering && h('button', {
          class: 'handle', type: 'button', 'data-act': 'handle', 'data-id': id,
          'aria-label': `Move ${name}, chapter ${roman(chapter)}. Arrow keys move it.`,
        }, '≡'));
    }

    /* Reordering a book: long-press a row, drag ≡ (or arrow keys), Done. */

    function enterReorder(id) {
      const m = listModel();
      if (!m.book) return;
      st.sort = 'order';
      st.reordering = true;
      renderList();
      navigator.vibrate?.(8);
      q(`.handle[data-id="${id}"]`)?.focus({ preventScroll: true });
      say('Reordering. Drag a handle, or use the arrow keys, then Done.');
    }
    function endReorder() {
      st.reordering = false;
      renderList();
      q('[data-act="new-note"]').focus({ preventScroll: true });
    }
    function moveNote(id, to) {
      const ids = order[st.list.id];
      const from = ids.indexOf(id);
      const moved = to >= 0 && to < ids.length && to !== from;
      if (moved) ids.splice(to, 0, ...ids.splice(from, 1));
      renderList();
      renderCrumb();
      q(`.handle[data-id="${id}"]`)?.focus({ preventScroll: true });
      if (moved) say(`${notes[id].title || 'Untitled'} is now ${roman(to + 1)}.`);
    }

    function startPress(e, row) {
      const x0 = e.clientX;
      const y0 = e.clientY;
      row.classList.add('is-pressing');
      const timer = setTimeout(() => {
        stop();
        swallowClick = true;
        enterReorder(row.dataset.id);
      }, LONG_PRESS_MS);
      const move = (ev) => Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8 && stop();
      function stop() {
        clearTimeout(timer);
        row.classList.remove('is-pressing');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
    }

    function startDrag(e, handle) {
      e.preventDefault();
      const item = handle.closest('.index-item');
      const items = [...index.children];
      const from = items.indexOf(item);
      const tops = items.map((it) => it.offsetTop);
      const step = item.offsetHeight;
      const y0 = e.clientY;
      let to = from;
      handle.setPointerCapture(e.pointerId);
      item.classList.add('is-lifted');
      index.classList.add('is-dragging');

      const move = (ev) => {
        const dy = Math.max(tops[0] - tops[from], Math.min(tops.at(-1) - tops[from], ev.clientY - y0));
        item.style.transform = `translateY(${dy}px)`;
        to = Math.round((tops[from] + dy - tops[0]) / step);
        items.forEach((it, i) => {
          let pos = i;
          if (it === item) pos = to;
          else if (from < to && i > from && i <= to) pos = i - 1;
          else if (from > to && i >= to && i < from) pos = i + 1;
          if (it !== item) it.style.transform = pos === i ? '' : `translateY(${(pos - i) * step}px)`;
          it.querySelector('.ordinal').textContent = roman(pos + 1); // renumber as they move
        });
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        index.classList.remove('is-dragging');
        moveNote(item.dataset.id, to);
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    }

    function newNote() {
      const m = listModel();
      const id = `made-${++st.made}`;
      notes[id] = {
        title: '', folder: m.folder || 'scraps', tags: m.kind === 'tag' ? [st.list.id] : [],
        date: 'now', age: 0, words: 0, base: 0, today: 0, text: [], versions: [], pinned: st.list.id === 'pinned',
      };
      if (m.book) order[m.folder].push(id);
      openNote(id);
      title.focus({ preventScroll: true });
    }

    /* III. Page */

    function renderPage() {
      const n = note();
      q('.view--page .bar__back').textContent = `← ${listModel().title}`;
      renderCrumb();
      q('.paper__tags').replaceChildren(...n.tags.map((t) => h('span', { text: `#${t}` })));
      title.textContent = n.title;
      renderBody();
    }

    function renderCrumb() {
      const n = note();
      const path = findIn(FOLDERS, n.folder) || [];
      const book = path.at(-1)?.book ? ` · ${roman(order[n.folder].indexOf(st.noteId) + 1)}` : '';
      q('.paper__crumb').textContent = path.map((f) => f.name).join(' › ') + book;
    }

    function renderBody() {
      const n = note();
      const seal = n.versions[st.baseline];
      let editable = false;
      prose.className = 'prose';
      if (st.compare === 'changes' && seal) {
        prose.replaceChildren(...compareNodes(seal.text, n.text).nodes);
      } else if (st.compare === 'sealed' && seal) {
        prose.replaceChildren(...blockNodes(seal.text));
      } else if (st.mode === 'source') {
        prose.classList.add('is-source');
        prose.replaceChildren(...sourceNodes(n));
        editable = true;
      } else {
        prose.classList.toggle('is-reading', st.mode === 'reading');
        prose.replaceChildren(...blockNodes(n.text));
        editable = st.mode === 'live';
      }
      prose.contentEditable = String(editable);
      prose.setAttribute('aria-readonly', String(!editable));
      setEditable(title, editable && st.mode === 'live');
      renderBand();
      renderColophon();
    }
    function setEditable(node, on) {
      try {
        node.contentEditable = on ? 'plaintext-only' : 'false';
      } catch {
        node.contentEditable = String(on);
      }
    }

    function blockNodes(blocks) {
      return blocks.map((b) => {
        if (b === '***') return h('p', { class: 'scene-break', role: 'separator', 'aria-label': 'Scene break', contenteditable: 'false' }, '***');
        const task = b.match(TASK);
        if (!task) return h('p', {}, b);
        const done = task[1] === 'x';
        return h('p', { class: 'task', 'data-done': done || null },
          h('span', { class: 'task-box', contenteditable: 'false', role: 'checkbox', tabindex: '0', 'aria-checked': String(done), 'aria-label': plain(b) }),
          h('span', { class: 'task__text' }, task[2]));
      });
    }

    // Reads the page back into blocks after typing.
    function readBlocks() {
      const out = [];
      prose.childNodes.forEach((node) => {
        const text = node.textContent.replace(/\s+/g, ' ').trim();
        if (node.classList?.contains('scene-break')) out.push('***');
        else if (node.classList?.contains('task')) out.push(`- [${node.dataset.done != null ? 'x' : ' '}] ${text}`);
        else if (text) out.push(text);
      });
      return out;
    }

    // Source: the .md as it is on disk — front matter, blank lines, `***`.
    function sourceNodes(n) {
      const out = [];
      const mark = (t) => h('span', { class: 'md-mark', text: t });
      const key = (t) => h('span', { class: 'md-key', text: t });
      const front = [n.fm && ['id', n.fm], n.tags.length && ['tags', `[${n.tags.join(', ')}]`]].filter(Boolean);
      if (front.length) {
        out.push(mark('---'), '\n');
        front.forEach(([k, v]) => out.push(key(`${k}:`), ` ${v}`, '\n'));
        out.push(mark('---'), '\n\n');
      }
      n.text.forEach((b, i) => {
        if (i) out.push(TASK.test(b) && TASK.test(n.text[i - 1]) ? '\n' : '\n\n');
        const task = b.match(TASK);
        if (b === '***') out.push(mark('***'));
        else if (task) out.push(mark(`- [${task[1]}] `), task[2]);
        else out.push(b);
      });
      return out;
    }
    function readSource() {
      const body = prose.innerText.replace(/\r/g, '').replace(/^---\n[\s\S]*?\n---\n?/, '');
      return body.split(/\n\s*\n/).flatMap((chunk) => {
        const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length && lines.every((l) => TASK.test(l))) return lines;
        return lines.length ? [lines.join(' ')] : [];
      });
    }

    // Compare: struck and tinted for what's gone, underlined and tinted for what's new.
    function compareNodes(from, to) {
      const out = [];
      let para = null;
      let run = null;
      let removed = 0;
      let added = 0;
      const paragraph = () => para || (out.push((para = h('p'))), para);
      for (const [op, word] of diff(tokens(from), tokens(to))) {
        if (word === '\n') {
          if (op === '-') paragraph().append(' ', h('del', { title: 'paragraph break removed' }, '¶'));
          else para = null;
          run = null;
          continue;
        }
        if (word === '***') {
          const says = { '=': 'Scene break', '+': 'Scene break, added', '-': 'Scene break, removed' }[op];
          const mark = op === '=' ? '***' : h(op === '+' ? 'ins' : 'del', {}, '***');
          out.push(h('p', { class: 'scene-break', role: 'separator', 'aria-label': says }, mark));
          para = null;
          run = null;
          continue;
        }
        const p = paragraph();
        if (p.childNodes.length) p.append(' ');
        if (op === '=') {
          p.append(word);
          run = null;
        } else {
          if (op === '-') removed++;
          else added++;
          if (run?.op === op) {
            p.lastChild.remove(); // the space belongs inside the run
            run.el.append(` ${word}`);
          } else {
            run = { op, el: h(op === '+' ? 'ins' : 'del', {}, word) };
            p.append(run.el);
          }
        }
      }
      return { nodes: out, removed, added };
    }

    function sealName(v) {
      return v.name ? `“${v.name}”` : `the seal of ${v.when}`;
    }

    function renderBand() {
      const band = q('.compare-band');
      const n = note();
      const seal = n.versions[st.baseline];
      band.hidden = st.compare === 'draft' || !seal;
      if (band.hidden) return;
      const { removed, added } = compareNodes(seal.text, n.text);
      const nothing = !removed && !added;
      q('.compare-band__state').textContent =
        st.compare === 'changes'
          ? `${nothing ? 'No changes since' : 'Changes since'} ${sealName(seal)}`
          : `Sealed ${seal.when}${seal.name ? ` · ${seal.name}` : ''}, read-only`;
      const key = q('.compare-band__key');
      if (st.compare === 'sealed') key.textContent = 'Your draft is kept as it is.';
      else if (nothing) key.textContent = 'The draft matches the seal.';
      else key.replaceChildren(h('del', { text: 'struck' }), ' removed · ', h('ins', { text: 'underlined' }), ' added');
    }

    function renderColophon(stamped = false) {
      const n = note();
      const seal = n.versions[st.baseline];
      const last = n.versions[0];
      const words = wordsOf(n);
      const sealed = (v, stamp) => (v ? [sealMark(stamp), `sealed ${v.when}`] : ['not sealed yet']);
      let parts;
      if (st.compare === 'changes' && seal) {
        const { removed, added } = compareNodes(seal.text, n.text);
        parts = ['changes', `−${removed} +${added} words`, sealed(seal)];
      } else if (st.compare === 'sealed' && seal) {
        parts = [sealed(seal), `${fmt(wordsOf(n, seal.text))} words`, 'read-only'];
      } else if (st.mode === 'reading') {
        parts = ['reading', `${fmt(words)} words`, `about ${Math.max(1, Math.round(words / 250))} min`];
      } else if (st.mode === 'source') {
        parts = ['source', `${fmt(words)} words`, sealed(last, stamped)];
      } else {
        const today = (n.today ?? 0) + countWords(n.text) - n.base;
        parts = [`${fmt(words)} words`, today && `today ${signed(today)}`, sealed(last, stamped)].filter(Boolean);
      }
      colophon.replaceChildren(...parts.flatMap((p, i) => (i ? [' · ', ...[p].flat()] : [p].flat())));
    }

    function flash(words) {
      clearTimeout(flashTimer);
      colophon.textContent = words;
      flashTimer = setTimeout(() => renderColophon(), FLASH_MS);
    }

    /* The page's controls, behind ⋯ */

    function openSheet(kind, opener) {
      st.sheet = kind;
      sheetOpener = opener;
      qa('.sheet-body').forEach((b) => (b.hidden = b.dataset.sheet !== kind));
      sheet.setAttribute('aria-label', kind === 'page' ? 'Page controls' : 'Settings');
      renderSheet();
      sheet.scrollTop = 0;
      views.inert = true;
      scrim.classList.add('is-open');
      sheet.classList.add('is-open');
      q(`.sheet-body[data-sheet="${kind}"] button:not(:disabled)`)?.focus({ preventScroll: true });
    }
    function closeSheet() {
      if (!st.sheet) return;
      st.sheet = null;
      views.inert = false;
      scrim.classList.remove('is-open');
      sheet.classList.remove('is-open');
      sheetOpener?.focus({ preventScroll: true });
    }

    const COMPARE_NEXT = { draft: 'changes', changes: 'sealed', sealed: 'draft' };

    function renderSheet() {
      const n = note();
      const seal = n.versions[st.baseline];
      qa('[data-act="mode"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === st.mode)));
      qa('[data-act="quotes"]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.quotes === st.quotes)));

      const compare = q('[data-act="compare"]');
      compare.disabled = !seal;
      qa('.cycle [data-state]').forEach((s) => s.classList.toggle('is-on', !!seal && s.dataset.state === st.compare));
      let words = 'Nothing sealed yet. Seal first, then compare.';
      if (seal && st.compare === 'draft') words = `Showing the draft. Tap for changes since ${sealName(seal)}.`;
      if (seal && st.compare === 'changes') {
        const { removed, added } = compareNodes(seal.text, n.text);
        words = `Showing changes since ${sealName(seal)}: ${removed} words struck, ${added} underlined.`;
      }
      if (seal && st.compare === 'sealed') words = `Showing ${sealName(seal)}, read-only.`;
      q('[data-compare-note]').textContent = words;
      compare.setAttribute('aria-label', `Compare. ${words} Next: ${COMPARE_NEXT[st.compare]}.`);

      q('[data-seal-value]').textContent = n.versions.length ? `last ${n.versions[0].when}` : 'never';
      renderVersions();
    }

    function renderVersions() {
      const n = note();
      const toggle = q('[data-act="versions"]');
      toggle.setAttribute('aria-expanded', String(st.versionsOpen));
      q('[data-versions-value]').textContent = `${n.versions.length} sealed ${st.versionsOpen ? '▾' : '▸'}`;
      const list = q('.versions');
      list.hidden = !st.versionsOpen;
      list.replaceChildren(
        h('li', {},
          h('div', { class: 'version' },
            h('span'),
            h('span', { class: 'version__what' },
              h('span', { class: 'version__name version__name--draft', text: 'Draft' }),
              h('span', { class: 'version__when', text: 'now' })),
            h('span', { class: 'count', text: `${fmt(wordsOf(n))} w` }))),
        ...n.versions.map((v, i) => {
          const comparing = i === st.baseline && st.compare !== 'draft';
          return h('li', { class: comparing ? 'is-selected' : null },
            h('button', {
              class: 'version', type: 'button', 'data-act': 'version', 'data-i': i,
              'aria-current': comparing ? 'true' : null,
              'aria-label': `Compare with ${sealName(v)}`,
            },
              sealMark(),
              h('span', { class: 'version__what' },
                v.name && h('span', { class: 'version__name', text: v.name }),
                h('span', { class: 'version__when', text: `sealed ${v.when}` })),
              h('span', { class: 'count', text: `${fmt(wordsOf(n, v.text))} w` })));
        }),
        n.versions.length
          ? h('li', { class: 'version__note', text: 'Tap a seal to compare the draft with it. Seals are kept for good.' })
          : h('li', { class: 'version__note', text: 'No seals yet. Seal keeps this version for good.' }),
      );
    }

    function setMode(mode) {
      Object.assign(st, { mode, compare: 'draft' });
      renderBody();
      renderSheet();
    }
    function setCompare(state) {
      st.compare = state;
      renderBody();
      renderSheet();
      say(q('[data-compare-note]').textContent);
    }

    function seal() {
      const n = note();
      closeSheet();
      if (n.versions[0] && same(n.versions[0].text, n.text)) return flash('No changes since the seal');
      n.versions.unshift({ when: 'just now', text: [...n.text] });
      n.fm ??= `01JC${String(Date.now()).slice(-6)}`;
      Object.assign(st, { baseline: 0, compare: 'draft' });
      renderBody();
      renderColophon(true);
      renderSheet();
      say('Sealed just now.');
    }

    function copyForAO3() {
      const n = note();
      const quotes = (s) => (st.quotes === 'straight' ? s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'") : s);
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const html = n.text
        .map((b) => (b === '***' ? '<p><br /></p><hr /><p><br /></p>' : `<p>${esc(quotes(plain(b)))}</p>`))
        .join('\n');
      navigator.clipboard?.writeText(html).catch(() => {});
      closeSheet();
      flash('Copied as AO3 HTML');
      say('Copied as AO3 HTML.');
    }

    /* Wiring */

    el.addEventListener('click', (e) => {
      const box = e.target.closest('.task-box');
      if (box) return toggleTask(box);
      const t = e.target.closest('[data-act]');
      if (!t || !el.contains(t) || t.disabled) return;
      switch (t.dataset.act) {
        case 'home':
          nav.scrollTo({ top: 0 });
          q('.search input').value = '';
          return;
        case 'twist': {
          const key = t.dataset.key;
          st.open.has(key) ? st.open.delete(key) : st.open.add(key);
          renderTree();
          return q(`.tree-twist[data-key="${key}"]`).focus({ preventScroll: true });
        }
        case 'open-list':
          return openList(t.dataset.kind, t.dataset.id);
        case 'open-note':
          if (swallowClick || st.reordering) return;
          return openNote(t.dataset.id);
        case 'back':
          return back();
        case 'sort': {
          const sorts = listModel().book ? SORTS.book : SORTS.plain;
          const now = st.sort ?? sorts[0];
          st.sort = sorts[(sorts.indexOf(now) + 1) % sorts.length];
          renderList();
          return say(`Sorted by ${SORT_SAYS[st.sort]}.`);
        }
        case 'new-note':
          return newNote();
        case 'done-reorder':
          return endReorder();
        case 'more':
          return openSheet('page', t);
        case 'settings':
          return openSheet('settings', t);
        case 'close-sheet':
          return closeSheet();
        case 'mode':
          return setMode(t.dataset.mode);
        case 'compare':
          return setCompare(COMPARE_NEXT[st.compare]);
        case 'draft':
          return setCompare('draft');
        case 'seal':
          return seal();
        case 'versions':
          st.versionsOpen = !st.versionsOpen;
          return renderVersions();
        case 'version':
          st.baseline = Number(t.dataset.i);
          closeSheet();
          return setCompare('changes');
        case 'ao3':
          return copyForAO3();
        case 'quotes':
          st.quotes = t.dataset.quotes;
          return renderSheet();
      }
    });

    function toggleTask(box) {
      if (prose.contentEditable !== 'true' || st.mode !== 'live') return;
      const line = box.closest('.task');
      const done = line.dataset.done == null;
      line.toggleAttribute('data-done', done);
      box.setAttribute('aria-checked', String(done));
      note().text = readBlocks();
    }

    q('.search').addEventListener('submit', (e) => {
      e.preventDefault();
      const query = e.target.q.value.trim();
      if (query) openList('search', null, query);
    });

    index.addEventListener('pointerdown', (e) => {
      swallowClick = false;
      const handle = e.target.closest('.handle');
      if (handle) return startDrag(e, handle);
      const row = e.target.closest('.index-open');
      if (row && !st.reordering && e.button === 0) startPress(e, row);
    });
    // A long press on touch, a right-click, or the context-menu key (Shift+F10): reorder.
    index.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.index-open');
      if (!row) return;
      e.preventDefault();
      if (!st.reordering) {
        swallowClick = true;
        enterReorder(row.dataset.id);
      }
    });

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && st.sheet) {
        e.preventDefault();
        return closeSheet();
      }
      if (e.key === 'Escape' && st.reordering) return endReorder();
      // From the keyboard: the menu key or Shift+F10 starts reordering; Alt+↑/↓ moves a chapter at once.
      const row = e.target.closest?.('.index-open');
      if (row && !st.reordering && listModel().book) {
        const id = row.dataset.id;
        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
          e.preventDefault();
          return enterReorder(id);
        }
        if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          enterReorder(id);
          return moveNote(id, order[st.list.id].indexOf(id) + (e.key === 'ArrowUp' ? -1 : 1));
        }
      }
      const handle = e.target.closest?.('.handle');
      if (handle && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const ids = order[st.list.id];
        return moveNote(handle.dataset.id, ids.indexOf(handle.dataset.id) + (e.key === 'ArrowUp' ? -1 : 1));
      }
      if (e.target.matches?.('.task-box') && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        return toggleTask(e.target);
      }
      if (e.target === title && e.key === 'Enter') {
        e.preventDefault();
        prose.focus({ preventScroll: true });
      }
    });

    prose.addEventListener('input', () => {
      note().text = st.mode === 'source' ? readSource() : readBlocks();
      clearTimeout(flashTimer);
      renderColophon();
    });
    title.addEventListener('input', () => {
      note().title = title.textContent.trim();
    });

    /* First paint: every pane ready, the starting one in front, nothing sliding. */
    renderTree();
    renderList();
    renderPage();
    renderSheet();
    go(start);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('is-still')));
  }

  document.execCommand('defaultParagraphSeparator', false, 'p');
  document.querySelectorAll('.phone').forEach((el) => makePhone(el, el.dataset.start));
  syncTheme();
  applyFace(root.dataset.face);
})();
