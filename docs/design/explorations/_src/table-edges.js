// The table's edges, for 1 · Handles and 3 · Menus: controls for the row and
// column under the pointer or the caret, and a + on the lines between them.

let hover = { r: -1, c: -1 };
function useEdges() {
  wrap.classList.add('has-edges');
  table.addEventListener('pointerover', (e) => {
    const cell = e.target.closest('th, td');
    if (!cell) return;
    hover = { r: +cell.parentElement.dataset.r, c: +cell.dataset.c };
    Table.onDraw();
  });
  wrap.addEventListener('pointerleave', () => { hover = { r: -1, c: -1 }; Table.onDraw(); });
  wrap.addEventListener('transitionend', (e) => { if (e.target === wrap) Table.onDraw(); });
}
/** Lights the row or column a removal would take, before it goes. */
function aim(kind, i) {
  for (const el of table.querySelectorAll('.is-aimed')) el.classList.remove('is-aimed');
  if (kind === 'col') for (const el of table.querySelectorAll(`[data-c="${i}"]:is(th, td)`)) el.classList.add('is-aimed');
  if (kind === 'row') for (const el of table.querySelectorAll(`tr[data-r="${i}"] > *`)) el.classList.add('is-aimed');
}

// The + on each line, with a name that says which line.
function insColName(c) {
  const n = cols();
  if (c === 0) return `Add a column before ${colName(0)}`;
  if (c === n) return `Add a column after ${colName(n - 1)}`;
  return `Add a column between ${colName(c - 1)} and ${colName(c)}`;
}
function insRowName(at) {
  if (at === 0) return 'Add a row under the head row';
  if (at === T.rows.length) return `Add a row after row ${at}`;
  return `Add a row between rows ${at} and ${at + 1}`;
}
/** A + on the line between two columns ('col') or rows ('row'); `at` is the line's index. */
function insertHtml(dir, at) {
  const name = dir === 'col' ? insColName(at) : insRowName(at);
  return `<button class="ins ins--${dir}" data-ins-${dir}="${at}" aria-label="${escHtml(name)}" data-tip="${dir === 'col' ? 'Add a column' : 'Add a row'}" data-tip-side="${dir === 'col' ? 'up' : 'left'}"><span class="ins__dot"></span><span class="ins__plus">${icon('plus')}</span><span class="ins__line"></span></button>`;
}
/** Where each line is: a column line's x, a row line's y, in the wrap's coordinates. */
const colLine = (g, c) => (c < g.cols.length ? g.cols[c].x : g.cols.at(-1).x + g.cols.at(-1).w);
const rowLine = (g, at) => (at < T.rows.length ? g.rows[at + 1].y : g.top + g.height);

