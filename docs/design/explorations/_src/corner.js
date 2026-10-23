// Shared by the three window-corner explorations (corner-*.html): Eien's
// window drawn in any of its states, the explorations' bar that picks one, and
// every state side by side. Each page adds its own CSS for .win[data-way='new'].

const WCTL = {
  min: '<path d="M1 5h8"/>',
  max: '<path d="M1.5 1.5h7v7h-7z"/>',
  close: '<path d="M1 1l8 8M9 1l-8 8"/>',
};
const wctl = (name) => `<svg viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1">${WCTL[name]}</svg>`;

/** The window in state `s` ({ layout, os, full, sb, way }). */
function windowHtml(s, live = true) {
  const sbRow = (name, count, d = 0, extra = '') => `<div class="sb__row${extra}" style="--d:${d}"><span class="n">${name}</span>${count}</div>`;
  const note = (ord, t, n, p, chosen) => `<div class="note${chosen ? ' is-chosen' : ''}"><span class="ord">${ord}</span><span class="t">${t}</span><span class="count">${n}</span><span class="p">${p}</span></div>`;
  const tools = (names) => names.map((n) => `<span class="icon-button" aria-hidden="true">${icon(n)}</span>`).join('');
  const sealTip = s.sb === 'open' ? 'Hide the sidebar' : 'Show the sidebar';
  return `<div class="win" data-layout="${s.layout}" data-os="${s.os}" data-full="${s.full}" data-sb="${s.sb}" data-way="${s.way}"${live ? '' : ' inert'}>
  <div class="win__top"><span class="win__title">What the Recruits Say</span></div>
  <div class="win__panes">
    <aside class="sb">
      <div class="sb__head"><span class="sb__vault">Eien</span></div>
      <div class="sb__body">
        <div class="sb__sec"><span class="label">Library</span></div>
        ${sbRow('All notes', '<span class="count">214</span>')}
        ${sbRow('Pinned', '<span class="count">3</span>')}
        <div class="sb__sec"><span class="label">Folders</span></div>
        ${sbRow('Fic', '<span class="count">41</span>')}
        ${sbRow('Beneath the Walls', '<span class="book">BOOK</span><span class="count">14</span>', 1, ' is-chosen')}
        ${sbRow('Ideas', '<span class="count">57</span>')}
        ${sbRow('Research', '<span class="count">9</span>')}
        <div class="sb__sec"><span class="label">Tags</span></div>
        ${sbRow('<span class="count">#</span> aot', '<span class="count">33</span>')}
        ${sbRow('<span class="count">#</span> draft', '<span class="count">14</span>')}
      </div>
      <div class="sb__foot"><span class="label">214 notes</span>${tools(['moon', 'panes3', 'settings'])}</div>
    </aside>
    <section class="ls">
      <div class="ls__band"><span class="field">Search</span></div>
      <div class="ls__head"><div class="ls__title">Beneath the Walls</div><span class="label">14 notes · 33,206 words · book</span></div>
      ${note('i', 'The Late Watch', '2,840', 'He takes the late watch, every night of the week.')}
      ${note('ii', 'Rations', '2,204', 'Half a loaf, a strip of dried meat, and a promise.')}
      ${note('iii', 'Below the Gate', '3,412', 'The water came up through the stones first.')}
      ${note('iv', 'What the Recruits Say', '3,051', 'They have a name for him in the barracks.', true)}
      ${note('v', 'The Long Way Round', '1,906', 'Nobody had walked the outer road in years.')}
    </section>
    <main class="pg">
      <div class="pg__band">
        <span class="pg__group">${tools(['live', 'source', 'reading'])}</span>
        <span class="pg__group">${tools(['compare', 'versions', 'focus', 'strip'])}</span>
        <span class="slip">${tools(['live', 'source', 'reading', 'compare', 'versions', 'focus', 'right'])}</span>
      </div>
      <div class="pg__blotter"><article class="sheet">
        <span class="label">Fic / Beneath the Walls / iv</span>
        <h1>What the Recruits Say</h1>
        <p>They have a name for him in the barracks, and none of them will say it where he can hear. He does not ask.</p>
        <p>Instead he takes the late watch, every night of the week, and lets them talk around the brazier as if he were part of the stone.</p>
      </article></div>
      <div class="colophon">3,051 words <span class="count">·</span> today 412 <span class="count">·</span> sealed 2h ago</div>
    </main>
  </div>
  <div class="shoulder" aria-hidden="true"></div>
  <div class="lights" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="wctl" aria-hidden="true"><span>${wctl('min')}</span><span>${wctl('max')}</span><span>${wctl('close')}</span></div>
  <button class="seal-button corner-seal" data-seal aria-label="${sealTip}" aria-expanded="${s.sb === 'open'}" data-tip="${sealTip}"${live ? '' : ' tabindex="-1"'}><span class="seal">永</span></button>
</div>`;
}

/** Each state there is: macOS's four, then Windows' and Linux's two (no full screen there: it's macOS's case). */
const ALL_STATES = [
  { os: 'mac', full: 'no', sb: 'open', name: 'macOS · in a window · sidebar open' },
  { os: 'mac', full: 'no', sb: 'shut', name: 'macOS · in a window · sidebar shut' },
  { os: 'mac', full: 'yes', sb: 'open', name: 'macOS · full screen · sidebar open' },
  { os: 'mac', full: 'yes', sb: 'shut', name: 'macOS · full screen · sidebar shut' },
  { os: 'win', full: 'no', sb: 'open', name: 'Windows, Linux · sidebar open' },
  { os: 'win', full: 'no', sb: 'shut', name: 'Windows, Linux · sidebar shut' },
];

let canvas;
function mountCornerPage({ id, note, notes }) {
  const pages = [['title', '1 · A title line'], ['stay', '2 · The seal stays'], ['shoulder', '3 · The desk’s shoulder']];
  const group = (attr, label, choices) => `<div class="xbar__group" data-x-set="${attr}"><span class="xbar__label">${label}</span>${choices.map(([v, w]) => `<button class="word-button" data-value="${v}">${w}</button>`).join('')}</div>`;
  document.body.insertAdjacentHTML('afterbegin', `
<header class="xbar">
  <span class="xbar__name">Eien · The window's corner</span>
  <nav class="xbar__group" aria-label="Directions">${pages.map(([p, w]) => `<a class="word-button" href="corner-${p}.html"${p === id ? ' aria-current="page"' : ''}>${w}</a>`).join('')}</nav>
  ${group('way', 'Show', [['new', 'This direction'], ['now', 'As built now']])}
  ${group('view', 'View', [['one', 'One state'], ['all', 'All states']])}
  ${group('layout', 'Layout', [['band', 'A · Band'], ['slip', 'B · Slip']])}
  ${group('os', 'System', [['mac', 'macOS'], ['win', 'Windows, Linux']])}
  ${group('full', 'Window', [['no', 'In a window'], ['yes', 'Full screen']])}
  ${group('sb', 'Sidebar', [['open', 'Open'], ['shut', 'Shut']])}
  ${group('theme', 'Light', [['light', 'Day'], ['dark', 'Night']])}
  <span class="xnote">${note}</span>
</header>
<main class="stage">
  <div class="canvas"></div>
  <aside class="notes">${notes}</aside>
</main>`);
  canvas = document.querySelector('.canvas');
  const root = document.documentElement;
  root.dataset.theme ??= matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  wireBar(draw);
  addEventListener('resize', fit);
  // The seal shows and hides the sidebar, as in the app: here it flips the bar's choice.
  canvas.addEventListener('click', (e) => {
    if (!e.target.closest('[data-seal]')) return;
    document.querySelector(`[data-x-set="sb"] [data-value="${root.dataset.sb === 'open' ? 'shut' : 'open'}"]`).click();
  });
}

let drawn = '';
/** Draws one window, or every state; one window is changed in place, so it moves as the app would. */
function draw() {
  const d = document.documentElement.dataset;
  const s = { layout: d.layout, os: d.os, full: d.full, sb: d.sb, way: d.way };
  if (!s.layout || !s.os || !s.full || !s.sb || !s.way || !d.view) return;
  if (d.view === 'all') {
    drawn = 'all';
    canvas.innerHTML = `<div class="states">${ALL_STATES.map((st) => `<div class="state"><span class="label state__name">${st.name}</span><div class="fit">${windowHtml({ ...s, ...st }, false)}</div></div>`).join('')}</div>`;
  } else {
    const win = canvas.querySelector('.win');
    if (drawn !== 'one' || !win) {
      drawn = 'one';
      canvas.innerHTML = `<div class="fit">${windowHtml(s)}</div>`;
    } else {
      Object.assign(win.dataset, s);
      const seal = win.querySelector('[data-seal]');
      const tip = s.sb === 'open' ? 'Hide the sidebar' : 'Show the sidebar';
      seal.setAttribute('aria-label', tip);
      seal.setAttribute('aria-expanded', String(s.sb === 'open'));
      seal.dataset.tip = tip;
    }
  }
  fit();
}
/** Scales each window to its box, keeping its real size inside. */
function fit() {
  for (const box of canvas.querySelectorAll('.fit')) {
    const win = box.firstElementChild;
    const room = box.parentElement === canvas ? canvas.clientWidth - 48 : box.clientWidth || box.parentElement.clientWidth;
    const tall = box.parentElement === canvas ? canvas.clientHeight - 48 : Infinity;
    const scale = Math.min(1, room / 1120, tall / 700);
    win.style.transform = `scale(${scale})`;
    box.style.width = box.parentElement === canvas ? `${1120 * scale}px` : '100%';
    box.style.height = `${700 * scale}px`;
  }
}
