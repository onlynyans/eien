// A key as this system writes it, shared by the table and split explorations.

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const mod = (e) => (MAC ? e.metaKey : e.ctrlKey);
/** A key as this system writes it: KEY('Mod-Alt-↓') is ⌥⌘↓ on a Mac (its order), Ctrl+Alt+↓ elsewhere. */
function KEY(k) {
  const parts = k.split('-');
  const key = parts.pop();
  const has = (m) => parts.includes(m);
  return MAC
    ? `${has('Alt') ? '⌥' : ''}${has('Shift') ? '⇧' : ''}${has('Mod') ? '⌘' : ''}${key}`
    : [has('Mod') && 'Ctrl', has('Alt') && 'Alt', has('Shift') && 'Shift', key].filter(Boolean).join('+');
}
