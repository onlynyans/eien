// Eien — the palette: which set of colours the tokens take. Washi is Eien's
// own (no attribute); Otaku sets data-palette="otaku" on <html> and
// themes/otaku.css overrides the colour tokens. The scheme (day, night or the
// system's) is separate: every palette defines both.
//
// Loaded in <head>, before the page draws, so a kept choice never flashes.
// Any button with data-palette-choice="washi|otaku" picks one; the choice is
// kept in localStorage where the browser allows it.

(() => {
  const KEY = 'eien-palette';
  const PALETTES = ['washi', 'otaku'];
  const root = document.documentElement;

  const current = () => root.dataset.palette || 'washi';

  function sync() {
    for (const button of document.querySelectorAll('[data-palette-choice]')) {
      button.setAttribute('aria-pressed', String(button.dataset.paletteChoice === current()));
    }
  }

  function apply(palette) {
    if (!PALETTES.includes(palette)) palette = 'washi';
    if (palette === 'washi') delete root.dataset.palette;
    else root.dataset.palette = palette;
    sync();
  }

  try {
    apply(localStorage.getItem(KEY));
  } catch {
    // Storage refused (a private window, a file:// page): Washi, for this visit.
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-palette-choice]');
    if (!button) return;
    apply(button.dataset.paletteChoice);
    try {
      if (current() === 'washi') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, current());
    } catch {
      // The choice still holds for this visit.
    }
  });

  // Buttons drawn later (the phone copies its template) still show the choice.
  document.addEventListener('DOMContentLoaded', sync);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-palette'] });
})();
