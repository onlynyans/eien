// Eien — choices kept on <html>, each a data attribute the tokens follow:
//   data-face     newsreader (the default) or another text face — FACES below
//   data-palette  washi (the default: no attribute) or otaku — which colours;
//                 themes/otaku.css overrides the colour tokens
//   data-density  comfortable (the default) or compact — how much air
//   data-frame    sheet (the default) or full — the page as a sheet on the
//                 blotter, or paper from edge to edge
//   data-numerals roman (the default) or arabic — how a book numbers its
//                 chapters: i, ii, iii or 1, 2, 3
// The scheme (day, night, the system's) is separate; every palette has both.
//
// Loaded in <head>, before the page draws, so a kept choice never flashes.
// Any button with data-<name>-choice="value" picks one; the choice is kept in
// localStorage where the browser allows it. A change is announced as an
// "eien-choice" event on document, for pages that draw text from a choice.

(() => {
  const root = document.documentElement;

  function keepChoice(name, values) {
    const [fallback] = values;
    const key = `eien-${name}`;
    const attribute = `data-${name}-choice`;
    const current = () => root.dataset[name] || fallback;

    function sync() {
      for (const button of document.querySelectorAll(`[${attribute}]`)) {
        button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === current()));
      }
    }

    function apply(value) {
      const chosen = values.includes(value) ? value : fallback;
      if (chosen === fallback) delete root.dataset[name];
      else root.dataset[name] = chosen;
      sync();
      document.dispatchEvent(new CustomEvent('eien-choice', { detail: { name, value: chosen } }));
    }

    try {
      apply(localStorage.getItem(key));
    } catch {
      // Storage refused (a private window, a file:// page): the default, for this visit.
    }

    document.addEventListener('click', (event) => {
      const button = event.target.closest?.(`[${attribute}]`);
      if (!button) return;
      apply(button.getAttribute(attribute));
      try {
        if (current() === fallback) localStorage.removeItem(key);
        else localStorage.setItem(key, current());
      } catch {
        // The choice still holds for this visit.
      }
    });

    // Buttons drawn later (the phone copies its template) still show the choice.
    document.addEventListener('DOMContentLoaded', sync);
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: [`data-${name}`] });
  }

  // The text faces, in the order the pickers show them, with their names.
  const FACES = {
    newsreader: 'Newsreader',
    literata: 'Literata',
    'plex-sans': 'IBM Plex Sans',
    'source-sans': 'Source Sans 3',
    atkinson: 'Atkinson Hyperlegible Next',
    schibsted: 'Schibsted Grotesk',
    hanken: 'Hanken Grotesk',
    instrument: 'Instrument Sans',
  };
  window.eienFaceName = (face) => FACES[face] ?? FACES.newsreader;

  keepChoice('face', Object.keys(FACES));
  keepChoice('palette', ['washi', 'otaku']);
  keepChoice('density', ['comfortable', 'compact']);
  keepChoice('frame', ['sheet', 'full']);
  keepChoice('numerals', ['roman', 'arabic']);

  const ROMAN = [
    ['m', 1000], ['cm', 900], ['d', 500], ['cd', 400], ['c', 100], ['xc', 90],
    ['l', 50], ['xl', 40], ['x', 10], ['ix', 9], ['v', 5], ['iv', 4], ['i', 1],
  ];
  const roman = (n) => {
    let out = '';
    for (const [glyph, value] of ROMAN) for (; n >= value; n -= value) out += glyph;
    return out;
  };

  /** Chapter n (from 1) in the chosen style: "iii" or "3". */
  window.eienChapterNumber = (n) => (root.dataset.numerals === 'arabic' ? String(n) : roman(n));
})();
