// Whether the window can hyphenate a language (#40, Phase 3d): Set as a book
// justifies only where words break at a hyphen, as justified lines without
// them open rivers. A Mac hyphenates from the system's dictionaries;
// Chromium on Windows and Linux fetches its own, which Electron never does,
// so there the book stays ragged and its imprint says so. Asked once a
// language: a long word in a narrow box breaks, or runs out of it.

/** A word long enough to break in any Latin-script language's dictionary. */
const WORD = 'incomprehensibilities';

const known = new Map<string, boolean>();

/** Whether words in `language` break at a hyphen here; never for a book that names none. */
export function hyphenates(language: string): boolean {
  if (language === '') return false;
  const kept = known.get(language);
  if (kept !== undefined) return kept;
  const probe = document.createElement('div');
  probe.lang = language;
  probe.textContent = WORD;
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'absolute',
    visibility: 'hidden',
    width: '4em',
    fontSize: '16px',
    lineHeight: '20px',
    hyphens: 'auto',
    overflowWrap: 'normal',
    wordBreak: 'normal',
  });
  document.body.append(probe);
  // Broken, the word takes more than one line; whole, it runs out of the box on one.
  const breaks = probe.offsetHeight > 20;
  probe.remove();
  known.set(language, breaks);
  return breaks;
}
