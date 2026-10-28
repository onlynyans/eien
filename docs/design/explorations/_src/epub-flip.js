// Shared by the turning explorations (epub-flip-*.html): Pages 2's leaf, turned
// with a motion of its own. A turn copies the page you're leaving as it was,
// moves the book on under it at once, and runs the direction's motion
// (Flip.play) between the two: the copy goes, or the new page comes. Dragging
// an edge (a finger anywhere on the phone) holds the motion part way, as a
// thumb holds a corner; let go past a third and the page turns, short of it
// and it falls back. Asked for, so it moves; none with reduced motion.

const Flip = {
  /** ({ from, to, dir, host }) => the motion's Animations. `from` is the copy of the page you left. */
  play: null,
  /** Whether a drag holds the motion part way (a page you can take hold of), or only starts it. */
  holds: true,
};
/** A motion's length: the calm time times `k`; the bar's Slow shows it four times slower. */
const turnTime = (k = 1) => (parseFloat(getComputedStyle(root).getPropertyValue('--eien-calm')) || 220) * k * (root.dataset.speed === 'slow' ? 4 : 1);
const EASE = () => getComputedStyle(root).getPropertyValue('--eien-ease').trim() || 'ease-out';
/** No motion where the system asks for less, or the bar's Motion says Reduced. */
const still = () => root.dataset.motion === 'reduced' || matchMedia('(prefers-reduced-motion: reduce)').matches;
const px = (name) => parseFloat(getComputedStyle(root).getPropertyValue(name)) || 0;

const sheetOf = (lv) => lv?.closest('.sheet, .phone__page');
/** The page as it is now, to move while the book is already on the next: seen, never reached. */
function copyOf(sheet) {
  const copy = sheet.cloneNode(true);
  copy.classList.add('flip-copy');
  copy.setAttribute('aria-hidden', 'true');
  copy.inert = true;
  for (const el of [copy, ...copy.querySelectorAll('[data-k], [data-main], [id], [tabindex]')]) {
    el.removeAttribute('data-k');
    el.removeAttribute('data-main');
    el.removeAttribute('id');
    el.removeAttribute('tabindex');
  }
  return copy;
}
/** Laid exactly over the page it was copied from. */
function layOver(copy, to) {
  Object.assign(copy.style, { position: 'absolute', left: `${to.offsetLeft}px`, top: `${to.offsetTop}px`, width: `${to.offsetWidth}px`, height: `${to.offsetHeight}px`, margin: '0', zIndex: '3' });
  to.parentElement.append(copy);
}

/** The book a page on (or to a chapter's edge), with no motion of its own; false at the book's ends. */
function stepBook(dir) {
  const lv = main();
  const np = R.p + dir * lv._.span;
  if (np >= 0 && np < lv._.pages) { R.p = np; place(lv, true); settle(); return true; }
  if (dir > 0 && R.c < CHAPTERS.length - 1) { R.c++; R.p = 0; draw(); return true; }
  if (dir < 0 && R.c > 0) { R.c--; R.p = Infinity; draw(); return true; }
  say(dir > 0 ? 'The end of the book' : 'The beginning of the book');
  return false;
}
/** Back to where a turn began: a turn let go short of a third. */
function unstep(at) {
  if (at.c !== R.c) { R.c = at.c; R.p = at.p; draw(); return; }
  R.p = at.p;
  place(main(), true);
  settle();
}

let turning = null;
/** Ends a turn now: a key pressed mid-turn finishes it rather than queuing behind it. */
function finishTurn() {
  if (!turning) return;
  for (const a of turning.anims) a.finish();
}
function cleanTurn(t) {
  t.copy.remove();
  for (const el of canvas.querySelectorAll('.flip-back, .flip-temp')) el.remove();
  for (const a of t.anims) a.cancel();
  const to = sheetOf(main());
  if (to) { to.style.zIndex = ''; to.style.transform = ''; to.style.opacity = ''; to.style.boxShadow = ''; }
  for (const el of canvas.querySelectorAll('.leaves')) { el.style.opacity = ''; el.style.transform = ''; }
  if (turning === t) turning = null;
}
/** Turn a page with the direction's motion; `held`, the motion waits for a drag to move it. */
function turnWith(dir, held = false) {
  finishTurn();
  const lv = main();
  if (!lv?._) return null;
  const at = { c: R.c, p: R.p };
  const copy = copyOf(sheetOf(lv));
  if (!stepBook(dir)) return null;
  if (still() || !Flip.play) return null;
  const to = sheetOf(main());
  layOver(copy, to);
  const anims = Flip.play({ from: copy, to, dir, host: to.parentElement });
  const t = { anims, copy, at, dir };
  turning = t;
  if (held) for (const a of anims) a.pause();
  Promise.all(anims.map((a) => a.finished)).then(() => { if (!t.back) cleanTurn(t); }).catch(() => {});
  return t;
}
act.turn = (dir) => turnWith(dir);

// Holding the page: a drag on an edge or a turning margin (anywhere on the phone's
// page, with a finger) moves the motion with the pointer.
let hold = null;
let swallowClick = false;
queueMicrotask(() => {
  canvas.addEventListener('pointerdown', (e) => {
    const onEdge = e.target.closest('.edges button, .turn');
    const onPhone = e.target.closest('.phone__body .phone__page');
    if (!onEdge && !onPhone) return;
    hold = { x: e.clientX, y: e.clientY, id: e.pointerId, t: null, width: (sheetOf(main())?.getBoundingClientRect().width || 1) };
  });
  // Followed on the window, not the page: a turn into another chapter draws the page anew under the pointer.
  addEventListener('pointermove', (e) => {
    if (!hold || e.pointerId !== hold.id) return;
    const dx = e.clientX - hold.x;
    if (!hold.t && !hold.dir && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - hold.y)) {
      hold.dir = dx < 0 ? 1 : -1; // drawn leftward, the next page; rightward, the one before
      if (Flip.holds) hold.t = turnWith(hold.dir, true);
      try { canvas.setPointerCapture(e.pointerId); } catch {} // a pointer already gone can't be held
    }
    if (hold.t) {
      const f = clamp(Math.abs(dx) / hold.width, 0, 1);
      hold.f = f;
      for (const a of hold.t.anims) a.currentTime = f * a.effect.getComputedTiming().endTime;
    }
  });
  const let_go = (e) => {
    if (!hold || e.pointerId !== hold.id) return;
    const h = hold;
    hold = null;
    if (!h.dir) return;
    swallowClick = true;
    setTimeout(() => { swallowClick = false; });
    if (!Flip.holds || !h.t) { if (!Flip.holds) turnWith(h.dir); return; }
    if ((h.f ?? 0) > 1 / 3) { for (const a of h.t.anims) a.play(); return; }
    // Short of a third: the page falls back, and the book is where it was.
    h.t.back = true;
    for (const a of h.t.anims) a.reverse();
    Promise.all(h.t.anims.map((a) => a.finished)).then(() => { cleanTurn(h.t); unstep(h.t.at); }).catch(() => {});
  };
  addEventListener('pointerup', let_go);
  addEventListener('pointercancel', let_go);
  // A drag that turned isn't also a click on the edge it started on.
  canvas.addEventListener('click', (e) => { if (swallowClick) { e.stopPropagation(); e.preventDefault(); } }, true);
});

/** The bar's two: how fast, and as your system has motion. */
const FLIP_BAR = `<div class="xbar__group" data-x-set="speed"><span class="xbar__label">Speed</span><button class="word-button" data-value="real">As designed</button><button class="word-button" data-value="slow">Four times slower</button></div>
<div class="xbar__group" data-x-set="motion"><span class="xbar__label">Motion</span><button class="word-button" data-value="full">As the system sets it</button><button class="word-button" data-value="reduced">Reduced</button></div>`;

/** What all three turning pages share, for their notes. */
const FLIP_NOTES = () => `
  <h2>In all three</h2>
  <ul>
    <li><b>The leaf is Pages 2's</b>, the recommended one: one page on the blotter, the book's fore-edge under it. Only the turn differs, and each ends with the fore-edge a step on.</li>
    <li><b>Turning:</b> <kbd>→</kbd> <kbd>Space</kbd> <kbd>PgDn</kbd> on, <kbd>←</kbd> <kbd>⇧Space</kbd> <kbd>PgUp</kbd> back; a click on the edges or the margins; on the phone a tap in either outer third. A key pressed mid-turn finishes the turn at once and starts the next, so reading fast never waits on a motion.</li>
    <li><b>Asked for, so it moves.</b> Nothing turns that you didn't turn. With reduced motion (the system's setting, or the bar's Motion) the page changes at once, with no motion at all.</li>
    <li><b>Timing:</b> each is a multiple of Eien's calm time (${Math.round(turnTime(1) / (root.dataset.speed === 'slow' ? 4 : 1))}ms) on its ease, which starts quick and settles: no spring, no bounce. The bar's Speed shows it four times slower, to look at.</li>
    <li><b>In the app</b> the page you leave is drawn once more in place while the motion runs, as here; the next one is already laid out under it, so nothing waits on the book.</li>
  </ul>`;
