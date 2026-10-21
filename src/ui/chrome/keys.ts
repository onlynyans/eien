// A command's key, written once as CodeMirror writes keys ("Mod-Shift-d",
// "Mod" being ⌘ on a Mac and Ctrl elsewhere), shown two ways: as a tooltip
// says it (⇧⌘D, Ctrl+Shift+D) and as aria-keyshortcuts names it.

const MAC_SIGNS: Record<string, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Mod: '⌘' };
/** The order a Mac writes its modifiers in. */
const MAC_ORDER = ['Ctrl', 'Alt', 'Shift', 'Mod'];
const MAC_KEYS: Record<string, string> = {
  Enter: '↵',
  Backspace: '⌫',
  ArrowUp: '↑',
  ArrowDown: '↓',
};

/** `key` split into its modifiers and the key itself ("-" alone is a key, as in "Mod--"). */
function partsOf(key: string): { mods: string[]; key: string } {
  const parts = key.split(/-(?!$)/);
  return { mods: parts.slice(0, -1), key: parts.at(-1) ?? '' };
}

const named = (key: string) => (key.length === 1 ? key.toUpperCase() : key);

/** `key` as a tooltip shows it on this system. */
export function keyText(key: string, mac: boolean): string {
  const parts = partsOf(key);
  if (!mac)
    return [...parts.mods.map((m) => (m === 'Mod' ? 'Ctrl' : m)), named(parts.key)].join('+');
  const mods = MAC_ORDER.filter((m) => parts.mods.includes(m)).map((m) => MAC_SIGNS[m]);
  return mods.join('') + (MAC_KEYS[parts.key] ?? named(parts.key));
}

/** `key` as aria-keyshortcuts names it (Meta+Shift+D). */
export function ariaKeys(key: string, mac: boolean): string {
  const parts = partsOf(key);
  const mods = parts.mods.map((m) =>
    m === 'Mod' ? (mac ? 'Meta' : 'Control') : m === 'Ctrl' ? 'Control' : m,
  );
  return [...mods, named(parts.key)].join('+');
}

/** A command's key on this system, as a tooltip shows it and as aria-keyshortcuts names it. */
export function keysOf(
  def: { readonly key?: string; readonly keyOffMac?: string; readonly keyThrough?: string },
  mac: boolean,
): { readonly text: string; readonly aria: string } | null {
  const key = mac ? def.key : (def.keyOffMac ?? def.key);
  if (!key) return null;
  if (!def.keyThrough) return { text: keyText(key, mac), aria: ariaKeys(key, mac) };
  // A run (⌘⌥1–3): each key named for aria-keyshortcuts, the first and last for the eye.
  const { mods, key: first } = partsOf(key);
  const run: string[] = [];
  for (let code = first.charCodeAt(0); code <= def.keyThrough.charCodeAt(0); code++) {
    run.push([...mods, String.fromCharCode(code)].join('-'));
  }
  return {
    text: `${keyText(key, mac)}–${def.keyThrough}`,
    aria: run.map((each) => ariaKeys(each, mac)).join(' '),
  };
}
