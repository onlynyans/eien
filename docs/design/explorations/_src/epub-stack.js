// The leaf and its fore-edge (Pages 2): the page pane, the phone's page and
// the numbers they show. Shared by Pages 2 and the turning explorations.
/** How many edges show: the pages left (or read), in sixths of the book, at least one while any are. */
const EDGES = 6;
const edgesFor = (n, before) => {
  if (!n) return 0;
  const frac = before ? (n.page - 1) / n.pages : (n.pages - n.page - n.span + 1) / n.pages;
  return frac <= 0 ? 0 : Math.max(1, Math.round(frac * EDGES));
};
const edgeHtml = (side, k) => Array.from({ length: k }, (_, i) => `<span class="edge edge--${side}" style="--i:${i + 1}" aria-hidden="true"></span>`).join('');

Epub.tools = (ctx) => ctx.contentsTool();
Epub.page = (ctx) => `<div class="page">${ctx.top()}<div class="blotter is-paged">
  <div class="stack" data-stack>
    <span data-edges></span>
    <article class="sheet book-sheet">${ctx.head()}${ctx.leaves(R.c)}
      <footer class="folio"><span class="count" data-chapter-pages></span><span class="count" data-folio></span></footer>
    </article>
    <span class="edges edges--before"><button data-turn="-1" data-k="edge-before" aria-label="Previous page" data-tip="Previous page  ←" data-tip-side="left"></button></span>
    <span class="edges edges--after"><button data-turn="1" data-k="edge-after" aria-label="Next page" data-tip="Next page  →" data-tip-side="right"></button></span>
  </div></div>${ctx.colophon([`<span data-col-chapter>${CHAPTERS[R.c].ord}</span>`, '<span data-col-page></span>', '<span data-col-left></span>'])}</div>`;
Epub.phone = (ctx) => `<div class="phone__page">${ctx.leaves(R.c)}<span class="phone-edge" aria-hidden="true"></span><div class="phone__foot"><span class="count" data-col-chapter>${CHAPTERS[R.c].ord}</span><span class="count" data-folio></span></div></div>`;
Epub.phoneTools = (ctx) => ctx.tool('contents', 'Contents', '', 'data-contents');
Epub.after = (ctx, n) => {
  if (!n?.paged) return;
  const set = (sel, text) => { for (const el of canvas.querySelectorAll(sel)) el.textContent = text; };
  set('[data-folio]', `${n.page}`);
  set('[data-chapter-pages]', `${CHAPTERS[R.c].ord} · ${n.chPage} of ${n.chPages}`);
  set('[data-col-page]', `page ${n.page} of ${n.pages}`);
  set('[data-col-left]', `${n.pages - n.page} to go`);
  const edges = canvas.querySelector('[data-edges]');
  if (edges) edges.innerHTML = edgeHtml('before', edgesFor(n, true)) + edgeHtml('after', edgesFor(n, false));
  const pe = canvas.querySelector('.phone-edge');
  if (pe) pe.innerHTML = Array.from({ length: edgesFor(n, false) }, (_, i) => `<i style="--i:${i}"></i>`).join('');
  for (const b of canvas.querySelectorAll('.edges button')) {
    const before = b.dataset.turn === '-1';
    const k = before ? n.page - 1 : n.pages - n.page;
    b.dataset.tip = `${before ? 'Previous page  ←' : 'Next page  →'}\n${k} page${k === 1 ? '' : 's'} ${before ? 'read' : 'to go'}`;
  }
};

