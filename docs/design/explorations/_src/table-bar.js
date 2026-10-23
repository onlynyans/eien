// The formatting bar's row, with its Table button, and the table's tools on
// one bar (2 · Toolbar; 3 · Menus' phone). Each page says where the bar goes
// and calls sync() whenever the table or the caret changes.

/** The formatting bar, as Band draws it, at the top of the page pane. `onTable`: its Table button. */
function formatBar(onTable) {
  const pane = document.querySelector('.pane');
  const button = (n) => `<button class="icon-button" tabindex="-1" data-icon="${n}" aria-label="${n}" data-tip="${n[0].toUpperCase() + n.slice(1)}"></button>`;
  pane.insertAdjacentHTML('afterbegin', `<div class="fbar" role="toolbar" aria-label="Formatting">
    ${['bold', 'italic', 'underline', 'strike'].map(button).join('')}<span class="fbar__rule"></span>
    ${['heading', 'quote', 'bullets', 'numbers', 'checklist', 'link'].map(button).join('')}
    <button class="icon-button fbar__table" data-icon="table" aria-label="Table" data-tip="Table"></button>
  </div>`);
  const fbar = pane.querySelector('.fbar');
  drawIcons(fbar);
  const table = fbar.querySelector('.fbar__table');
  table.addEventListener('mousedown', (e) => e.preventDefault());
  table.addEventListener('click', onTable);
  return fbar;
}

const TABLE_TOOLS = [
  ['rowAbove', 'Add a row above', 'Mod-Alt-↑', () => ops.insertRow(Math.max(0, here.r - 1))],
  ['rowBelow', 'Add a row below', 'Mod-Alt-↓', () => ops.insertRow(here.r)],
  ['rowDelete', 'Remove this row', 'Mod-Alt-⌫', () => ops.deleteRow(here.r), 'tbar__off'],
  '|',
  ['colLeft', 'Add a column to the left', 'Mod-Alt-←', () => ops.insertCol(here.c)],
  ['colRight', 'Add a column to the right', 'Mod-Alt-→', () => ops.insertCol(here.c + 1)],
  ['colDelete', 'Remove this column', 'Mod-Alt-Shift-⌫', () => ops.deleteCol(here.c), 'tbar__off'],
  '|',
  ['alignLeft', 'Align the column left', '', () => ops.align(here.c, 'left')],
  ['alignCenter', 'Align the column centre', '', () => ops.align(here.c, 'center')],
  ['alignRight', 'Align the column right', '', () => ops.align(here.c, 'right')],
  '|',
];

/** The table's tools: one toolbar, its arrows moving along it (one tab stop), Esc back to the cell. */
function tableBar() {
  const bar = document.createElement('div');
  bar.className = 'tbar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Table');
  bar.dataset.tablePart = '';
  bar.innerHTML = TABLE_TOOLS.map((t) => (t === '|'
    ? '<span class="tbar__rule" aria-hidden="true"></span>'
    : `<button class="icon-button ${t[4] ?? ''}" tabindex="-1" data-act="${t[0]}" aria-label="${t[1]}" data-tip="${t[1]}${t[2] ? `  ${KEY(t[2])}` : ''}">${icon(t[0])}</button>`)).join('') + '<span class="tbar__where count"></span>';
  const buttons = [...bar.querySelectorAll('button')];
  const run = Object.fromEntries(TABLE_TOOLS.filter((t) => t !== '|').map((t) => [t[0], t[3]]));
  let roving = 0;
  /** How each tool looks now: what can't be done says why when pressed, rather than vanishing. */
  function sync() {
    bar.classList.toggle('is-shown', inTable || bar.contains(document.activeElement));
    bar.querySelector('[data-act="rowDelete"]').setAttribute('aria-disabled', String(here.r === 0));
    bar.querySelector('[data-act="colDelete"]').setAttribute('aria-disabled', String(cols() === 1));
    for (const a of ['left', 'center', 'right']) bar.querySelector(`[data-act="${ALIGN_ICON[a]}"]`).setAttribute('aria-pressed', String(T.align[here.c] === a));
    bar.querySelector('.tbar__where').textContent = `${here.r === 0 ? 'HEAD' : `ROW ${here.r}`} · COL ${here.c + 1}`;
    buttons.forEach((b, i) => { b.tabIndex = i === roving ? 0 : -1; });
  }
  // The pointer's press keeps the caret in its cell; the keyboard stays on the bar.
  bar.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    run[b.dataset.act]();
    if (e.detail === 0) { roving = buttons.indexOf(b); sync(); b.focus(); }
  });
  bar.addEventListener('keydown', (e) => {
    const i = buttons.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
    if (to !== undefined) {
      e.preventDefault();
      roving = (to + buttons.length) % buttons.length;
      sync();
      buttons[roving].focus();
    } else if (e.key === 'Escape') { e.preventDefault(); toCell(); }
  });
  bar.addEventListener('focusout', () => setTimeout(() => Table.onDraw()));
  return { bar, sync, focus: () => buttons[roving].focus() };
}
