// Whether the page's controls are hidden (#16: A's band to a lip, B's slip
// folded away), remembered on this device as the panes are.

const KEY = 'eien.strip';

export function stripShut(): boolean {
  try {
    return localStorage.getItem(KEY) === 'shut';
  } catch {
    return false;
  }
}

export function rememberStrip(shut: boolean): void {
  try {
    if (shut) localStorage.setItem(KEY, 'shut');
    else localStorage.removeItem(KEY);
  } catch {
    // Storage refused: the strip holds until the window closes.
  }
}
