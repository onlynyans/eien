// Shared by the three table explorations (table-*.html): a GFM table as the
// file holds it, drawn as cells you type in; the keys, the undo, the file and
// the colophon every direction shares. Each page adds only its controls, by
// setting Table.onDraw, Table.onMove, Table.onKey and Table.onBar (a choice of
// its own on the explorations' bar).

// The table's icons, on the same 16-unit grid as the rest.
Object.assign(ICONS, {
  table: '<path d="M2.5 3h11v10h-11z"/><path d="M2.5 6.5h11M2.5 9.8h11M7 6.5V13"/>',
  rowAbove: '<path d="M2.5 8.5h11v5h-11z"/><path d="M2.5 11h11" opacity=".45"/><path d="M8 1.8v4.4M5.8 4h4.4"/>',
  rowBelow: '<path d="M2.5 2.5h11v5h-11z"/><path d="M2.5 5h11" opacity=".45"/><path d="M8 9.8v4.4M5.8 12h4.4"/>',
  colLeft: '<path d="M8.5 2.5h5v11h-5z"/><path d="M11 2.5v11" opacity=".45"/><path d="M4 5.8v4.4M1.8 8h4.4"/>',
  colRight: '<path d="M2.5 2.5h5v11h-5z"/><path d="M5 2.5v11" opacity=".45"/><path d="M12 5.8v4.4M9.8 8h4.4"/>',
  rowDelete: '<path d="M2.5 5h11v6h-11z"/><path d="M6.8 6.8l2.4 2.4M9.2 6.8l-2.4 2.4"/>',
  colDelete: '<path d="M5 2.5h6v11H5z"/><path d="M6.8 6.8l2.4 2.4M9.2 6.8l-2.4 2.4"/>',
  alignLeft: '<path d="M2.5 4h11M2.5 7h7M2.5 10h11M2.5 13h7"/>',
  alignCenter: '<path d="M2.5 4h11M4.5 7h7M2.5 10h11M4.5 13h7"/>',
  alignRight: '<path d="M2.5 4h11M6.5 7h7M2.5 10h11M6.5 13h7"/>',
  gripRow: '<circle cx="6" cy="4" r=".7"/><circle cx="10" cy="4" r=".7"/><circle cx="6" cy="8" r=".7"/><circle cx="10" cy="8" r=".7"/><circle cx="6" cy="12" r=".7"/><circle cx="10" cy="12" r=".7"/>',
  gripCol: '<circle cx="4" cy="6" r=".7"/><circle cx="4" cy="10" r=".7"/><circle cx="8" cy="6" r=".7"/><circle cx="8" cy="10" r=".7"/><circle cx="12" cy="6" r=".7"/><circle cx="12" cy="10" r=".7"/>',
});
const ALIGN_ICON = { left: 'alignLeft', center: 'alignCenter', right: 'alignRight' };

const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The table, as the file holds it. Row 0 is the head row, which GFM always has.
const T = {
  head: ['Chapter', 'POV', 'Words', 'State'],
  align: ['left', 'left', 'right', 'center'],
  rows: [
    ['i · The Late Watch', 'Levi', '2,840', 'sealed'],
    ['ii · Rations', 'Hange', '2,204', 'sealed'],
    ['iii · Below the Gate', 'Levi', '3,412', 'draft'],
    ['iv · What the Recruits Say', 'Erwin', '3,051', 'draft'],
  ],
};
const BEFORE = ['---', 'tags: [fic/aot, planning]', '---', '', 'The chapters so far, and where each one stands.', ''];
const AFTER = ['', 'Erwin’s still needs the scene at the gate.'];

const Table = { onDraw() {}, onMove() {}, onKey() { return false; }, onBar() {} };
let here = { r: 1, c: 0 };
let inTable = false;
const cols = () => T.head.length;
const rowOf = (r) => (r === 0 ? T.head : T.rows[r - 1]);
const colName = (c) => T.head[c].trim() || `column ${c + 1}`;
const rowName = (r) => (r === 0 ? 'the head row' : `row ${r}`);

const escapePipes = (s) => s.replace(/(\\*)\|/g, (pipe, slashes) => (slashes.length % 2 ? pipe : `${slashes}\\|`));
/** The table's lines in the file: tidy pads each column to its widest cell, compact doesn't. */
function tableLines(tidy) {
  // A pipe ends a cell, so it's written \| unless the writer already escaped it: a pipe after
  // an odd run of backslashes is escaped already. Other backslashes are the writer's Markdown.
  const all = [T.head, ...T.rows].map((row) => row.map(escapePipes));
  const width = T.head.map((_, c) => (tidy ? Math.max(3, ...all.map((row) => [...row[c]].length)) : 3));
  const pad = (s, c) => {
    if (!tidy) return s;
    const n = width[c] - [...s].length;
    if (T.align[c] === 'right') return ' '.repeat(n) + s;
    if (T.align[c] === 'center') return ' '.repeat(n >> 1) + s + ' '.repeat(n - (n >> 1));
    return s + ' '.repeat(n);
  };
  const line = (row) => `| ${row.map(pad).join(' | ')} |`;
  const rule = (c) => {
    const a = T.align[c];
    const dashes = '-'.repeat(width[c] - (a === 'center' ? 2 : a === 'right' ? 1 : 0));
    return a === 'center' ? `:${dashes}:` : a === 'right' ? `${dashes}:` : dashes;
  };
  return [line(all[0]), `| ${T.head.map((_, c) => rule(c)).join(' | ')} |`, ...all.slice(1).map(line)];
}

// The page every direction shares: the sheet, the table, the colophon, the file.
let wrap, table, scroller, layer, src, where, said;
function mountTablePage({ id, name, note, notes, bar = '' }) {
  const pages = [['handles', '1 · Handles'], ['toolbar', '2 · Toolbar'], ['menus', '3 · Menus']];
  const group = (attr, label, choices) => `<div class="xbar__group" data-x-set="${attr}"><span class="xbar__label">${label}</span>${choices.map(([v, w]) => `<button class="word-button" data-value="${v}">${w}</button>`).join('')}</div>`;
  document.body.insertAdjacentHTML('afterbegin', `
<header class="xbar">
  <span class="xbar__name">Eien · Tables in Live</span>
  <nav class="xbar__group" aria-label="Directions">${pages.map(([p, w]) => `<a class="word-button" href="table-${p}.html"${p === id ? ' aria-current="page"' : ''}>${w}</a>`).join('')}</nav>
  ${group('theme', 'Light', [['light', 'Day'], ['dark', 'Night']])}
  ${group('layout', 'Corners', [['band', 'A · Band'], ['slip', 'B · Slip'], ['runhead', 'C · Running head']])}
  ${group('device', 'Show', [['desktop', 'Desktop'], ['phone', 'Phone']])}
  ${group('tidy', 'File', [['tidy', 'Tidy pipes'], ['compact', 'Compact']])}
  ${bar}
  <span class="xnote">${note}</span>
</header>
<main class="stage">
  <div class="pane">
    <div class="page">
      <article class="sheet">
        <span class="label">Fic / Beneath the Walls / Plan</span>
        <h1 class="title">The plan</h1>
        <p class="prose">${BEFORE[4]}</p>
        <div class="tbl-wrap"><div class="tbl-scroll"><table class="tbl" aria-label="Table: ${name}"></table></div><div class="tbl-layer"></div></div>
        <p class="prose" tabindex="-1" data-after>${AFTER[1]}</p>
      </article>
    </div>
    <footer class="colophon"><span class="colophon__where"></span><span class="colophon__said" role="status" aria-live="polite"></span></footer>
  </div>
  <aside class="file" aria-label="The file">
    <div class="file__head"><span class="label">The file</span><span class="count">fic/beneath-the-walls/plan.md</span></div>
    <pre class="file__src" aria-label="The note’s Markdown, as saved"></pre>
    <div class="file__notes">${notes}</div>
  </aside>
</main>`);
  wrap = document.querySelector('.tbl-wrap');
  table = wrap.querySelector('.tbl');
  scroller = wrap.querySelector('.tbl-scroll');
  layer = wrap.querySelector('.tbl-layer');
  src = document.querySelector('.file__src');
  where = document.querySelector('.colophon__where');
  said = document.querySelector('.colophon__said');
  wireTable();
  const root = document.documentElement;
  root.dataset.theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  wireBar((attr) => {
    if (attr === 'tidy') drawFile();
    if (attr === 'device') setTouch();
    Table.onBar(attr);
    requestAnimationFrame(() => Table.onDraw());
  });
  matchMedia('(hover: none)').addEventListener('change', setTouch);
  addEventListener('resize', () => Table.onDraw());
  scroller.addEventListener('scroll', () => Table.onDraw());
  drawIcons();
}
/** Touch: a phone shown here, or a pointer that can't hover. Nothing waits for a hover then. */
function setTouch() {
  const root = document.documentElement;
  root.classList.toggle('is-touch', root.dataset.device === 'phone' || matchMedia('(hover: none)').matches);
}
const isTouch = () => document.documentElement.classList.contains('is-touch');

const PLAIN = (() => { const d = document.createElement('div'); try { d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only'; } catch { return false; } })();
function drawTable() {
  const cell = (text, r, c) => `<div class="cell" contenteditable="${PLAIN ? 'plaintext-only' : 'true'}" spellcheck="true" role="textbox" aria-label="${escHtml(r === 0 ? `Heading of column ${c + 1}` : `${colName(c)}, row ${r}`)}" data-r="${r}" data-c="${c}">${escHtml(text)}</div>`;
  table.innerHTML = `<thead><tr data-r="0">${T.head.map((t, c) => `<th scope="col" data-c="${c}" data-align="${T.align[c]}">${cell(t, 0, c)}</th>`).join('')}</tr></thead>
    <tbody>${T.rows.map((row, i) => `<tr data-r="${i + 1}">${row.map((t, c) => `<td data-c="${c}" data-align="${T.align[c]}">${cell(t, i + 1, c)}</td>`).join('')}</tr>`).join('')}</tbody>`;
}
const cellAt = (r, c) => table.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
const posOf = (el) => ({ r: +el.dataset.r, c: +el.dataset.c });

/** Puts the caret in a cell: at its 'start', its 'end', or round 'all' its words. */
function focusCell(r, c, at = 'end') {
  const el = cellAt(r, c);
  if (!el) return;
  el.focus({ preventScroll: false });
  const range = document.createRange();
  range.selectNodeContents(el);
  if (at !== 'all') range.collapse(at === 'start');
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}
/** Whether the caret is at a cell's start or end, with nothing selected. */
function atEdge(el, side) {
  const sel = getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const caret = sel.getRangeAt(0);
  const rest = document.createRange();
  rest.selectNodeContents(el);
  if (side === 'start') rest.setEnd(caret.startContainer, caret.startOffset);
  else rest.setStart(caret.endContainer, caret.endOffset);
  return rest.toString().length === 0;
}

// Undo: each change keeps the table as it was, so ⌘Z puts back what a removal took.
const past = [];
const future = [];
const snapshot = () => JSON.stringify({ T, here });
function restore(json) {
  const s = JSON.parse(json);
  Object.assign(T, s.T);
  redraw(s.here);
}
function undo() {
  if (!past.length) return say('Nothing to undo');
  future.push(snapshot());
  restore(past.pop());
  say('Undone');
}
function redo() {
  if (!future.length) return say('Nothing to redo');
  past.push(snapshot());
  restore(future.pop());
  say('Redone');
}
/** A change to the table's shape: `fn` makes it and says where the caret goes, or false. */
function change(words, fn) {
  const before = snapshot();
  const to = fn();
  if (to === false) return false;
  past.push(before);
  future.length = 0;
  lastTyped = {};
  redraw(to);
  say(words);
  return true;
}
const hasWords = (cells) => cells.some((s) => s.trim());
const back = () => ` · ${KEY('Mod-Z')} puts it back`;
const ops = {
  /** A new row at body index `at` (0 is first under the head). */
  insertRow(at, c = here.c) {
    return change('Row added', () => { T.rows.splice(at, 0, T.head.map(() => '')); return { r: at + 1, c }; });
  },
  deleteRow(r) {
    if (r === 0) { say('The head row stays: a Markdown table always has one'); return false; }
    const gone = T.rows[r - 1];
    return change(`Row ${r} removed${hasWords(gone) ? back() : ''}`, () => {
      T.rows.splice(r - 1, 1);
      return { r: Math.min(r, T.rows.length), c: here.c };
    });
  },
  /** A new column at index `at`; the caret goes to its head, to name it. */
  insertCol(at) {
    return change('Column added: name it', () => {
      T.head.splice(at, 0, '');
      T.align.splice(at, 0, 'left');
      for (const row of T.rows) row.splice(at, 0, '');
      return { r: 0, c: at };
    });
  },
  deleteCol(c) {
    if (cols() === 1) { say('The last column stays: delete the table in Source'); return false; }
    const name = colName(c);
    const gone = [T.head[c], ...T.rows.map((row) => row[c])];
    return change(`Column ${name} removed${hasWords(gone) ? back() : ''}`, () => {
      T.head.splice(c, 1);
      T.align.splice(c, 1);
      for (const row of T.rows) row.splice(c, 1);
      return { r: here.r, c: Math.min(c, cols() - 1) };
    });
  },
  align(c, a) {
    if (T.align[c] === a) return false;
    return change(`${colName(c)} aligned ${a}`, () => { T.align[c] = a; return here; });
  },
  /** Moves body row `from` (1-based) to stand at body index `to` of what's left. */
  moveRow(from, to) {
    if (from === 0 || to + 1 === from) return false;
    return change(`Row ${from} moved`, () => {
      const [row] = T.rows.splice(from - 1, 1);
      T.rows.splice(to, 0, row);
      return { r: to + 1, c: here.c };
    });
  },
  moveCol(from, to) {
    if (to === from) return false;
    return change(`${colName(from)} moved`, () => {
      for (const list of [T.head, T.align, ...T.rows]) { const [x] = list.splice(from, 1); list.splice(to, 0, x); }
      return { r: here.r, c: to };
    });
  },
};

function redraw(to = here) {
  drawTable();
  here = { r: Math.max(0, Math.min(to.r, T.rows.length)), c: Math.max(0, Math.min(to.c, cols() - 1)) };
  drawFile();
  focusCell(here.r, here.c, 'end');
  Table.onDraw();
}

let lastTyped = {};
let saidTimer;
function say(words) {
  said.textContent = words;
  clearTimeout(saidTimer);
  saidTimer = setTimeout(() => { said.textContent = ''; }, 6000);
}
function drawWhere() {
  where.textContent = inTable
    ? `${here.r === 0 ? 'Head row' : `Row ${here.r} of ${T.rows.length}`} · Column ${here.c + 1} of ${cols()} · ${T.align[here.c]}`
    : `Table · ${T.rows.length} rows · ${cols()} columns`;
}

let shown = [];
/** The file, redrawn only where it changed: the lines that differ flash moss once. */
function drawFile() {
  const tidy = document.documentElement.dataset.tidy !== 'compact';
  const lines = [...BEFORE, ...tableLines(tidy), ...AFTER];
  const same = lines.length === shown.length && lines.every((l, i) => l === shown[i]);
  if (!same) {
    let p = 0;
    while (p < lines.length && lines[p] === shown[p]) p++;
    let s = 0;
    while (s < lines.length - p && lines[lines.length - 1 - s] === shown[shown.length - 1 - s]) s++;
    const first = BEFORE.length;
    const last = lines.length - AFTER.length;
    src.innerHTML = lines.map((l, i) => {
      const cls = ['ln', i >= first && i < last && 'is-table', shown.length && i >= p && i < lines.length - s && 'is-changed'];
      // Each line ends in its newline, so the file copies as it's saved.
      return `<span class="${cls.filter(Boolean).join(' ')}">${escHtml(l)}\n</span>`;
    }).join('');
    shown = lines;
  }
  const at = BEFORE.length + (here.r === 0 ? 0 : here.r + 1);
  src.querySelectorAll('.ln').forEach((ln, i) => ln.classList.toggle('is-here', inTable && i === at));
  if (inTable) src.children[at]?.scrollIntoView({ block: 'nearest' });
  drawWhere();
}

/** Where each column and row is, in the wrap's own coordinates, for the controls laid over them. */
function geometry() {
  const base = wrap.getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  const t = table.getBoundingClientRect();
  const cols = [...table.rows[0].cells].map((th) => { const b = th.getBoundingClientRect(); return { x: b.left - base.left, w: b.width }; });
  const rows = [...table.rows].map((tr) => { const b = tr.getBoundingClientRect(); return { y: b.top - base.top, h: b.height }; });
  return { cols, rows, top: t.top - base.top, height: t.height, left: view.left - base.left, right: Math.min(t.right, view.right) - base.left };
}

/** The table counts as "in use" while focus is in it or in a control marked data-table-part. */
const inside = (el) => !!el?.closest?.('.tbl-wrap, [data-table-part]');
function setIn(on) {
  if (inTable === on) return;
  inTable = on;
  wrap.classList.toggle('is-in', on);
  drawFile();
  Table.onDraw();
}
/** Back to the caret's cell, from a control. */
const toCell = () => focusCell(here.r, here.c, 'end');

function wireTable() {
  table.addEventListener('focusin', (e) => {
    const el = e.target.closest('.cell');
    if (!el) return;
    here = posOf(el);
    setIn(true);
    drawFile();
    Table.onMove(here);
  });
  document.addEventListener('focusout', (e) => {
    if (inside(e.target) && !inside(e.relatedTarget)) setTimeout(() => { if (!inside(document.activeElement)) setIn(false); });
  });
  table.addEventListener('input', (e) => {
    const el = e.target.closest('.cell');
    const { r, c } = posOf(el);
    const key = `${r}:${c}`;
    if (key !== lastTyped.key || Date.now() - lastTyped.at > 1500) { past.push(snapshot()); future.length = 0; }
    lastTyped = { key, at: Date.now() };
    rowOf(r)[c] = el.textContent.replace(/\n/g, ' ');
    drawFile();
    Table.onDraw();
  });
  // A cell is one line in Markdown: pasted lines join with spaces.
  table.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain').replace(/\s*\n\s*/g, ' '));
  });
  table.addEventListener('keydown', (e) => {
    const el = e.target.closest('.cell');
    if (!el || Table.onKey(e)) return;
    const { r, c } = here;
    const n = cols();
    const last = T.rows.length;
    const go = (r2, c2, at) => { e.preventDefault(); focusCell(r2, c2, at); };
    const k = e.key;
    if (mod(e) && e.altKey) {
      const act = {
        ArrowUp: () => ops.insertRow(Math.max(0, r - 1)),
        ArrowDown: () => ops.insertRow(r),
        ArrowLeft: () => ops.insertCol(c),
        ArrowRight: () => ops.insertCol(c + 1),
        Backspace: () => (e.shiftKey ? ops.deleteCol(c) : ops.deleteRow(r)),
      }[k];
      if (act) { e.preventDefault(); act(); }
      return;
    }
    if (mod(e) && k.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod(e) && k.toLowerCase() === 'y' && !MAC) { e.preventDefault(); redo(); return; }
    if (k === 'Tab') {
      if (e.shiftKey) { if (c > 0) go(r, c - 1, 'all'); else if (r > 0) go(r - 1, n - 1, 'all'); else e.preventDefault(); }
      else if (c < n - 1) go(r, c + 1, 'all');
      else if (r < last) go(r + 1, 0, 'all');
      else { e.preventDefault(); ops.insertRow(last, 0); }
    } else if (k === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) say('A cell is one line in Markdown');
      else ops.insertRow(r);
    } else if (k === 'ArrowUp' && !e.shiftKey && r > 0) go(r - 1, c, 'end');
    else if (k === 'ArrowDown' && !e.shiftKey && r < last) go(r + 1, c, 'end');
    else if (k === 'ArrowLeft' && !e.shiftKey && atEdge(el, 'start') && (c > 0 || r > 0)) go(c > 0 ? r : r - 1, c > 0 ? c - 1 : n - 1, 'end');
    else if (k === 'ArrowRight' && !e.shiftKey && atEdge(el, 'end') && (c < n - 1 || r < last)) go(c < n - 1 ? r : r + 1, c < n - 1 ? c + 1 : 0, 'start');
    else if (k === 'Escape') {
      e.preventDefault();
      document.querySelector('[data-after]').focus();
      say('Out of the table');
    }
  });
  drawTable();
  drawFile();
}

/** The keys every direction shares, for its notes. */
const SHARED_KEYS = () => `
  <h2>Keys, in all three</h2>
  <ul>
    <li><kbd>Tab</kbd> <kbd>⇧Tab</kbd> next and last cell; <kbd>Tab</kbd> in the last cell adds a row</li>
    <li>Arrows move between cells at a cell's edge; <kbd>↑</kbd> <kbd>↓</kbd> always</li>
    <li><kbd>Enter</kbd> a new row under this one; <kbd>Esc</kbd> out of the table</li>
    <li><kbd>${KEY('Mod-Alt-↑')}</kbd> <kbd>${KEY('Mod-Alt-↓')}</kbd> row above, below; <kbd>${KEY('Mod-Alt-←')}</kbd> <kbd>${KEY('Mod-Alt-→')}</kbd> column left, right</li>
    <li><kbd>${KEY('Mod-Alt-⌫')}</kbd> remove the row; <kbd>${KEY('Mod-Alt-Shift-⌫')}</kbd> the column; <kbd>${KEY('Mod-Z')}</kbd> puts either back</li>
  </ul>`;
