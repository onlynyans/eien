import { describe, expect, it } from 'vitest';
import { ariaKeys, keysOf, keyText } from './keys';

describe('keyText', () => {
  it('writes a Mac’s keys as its menus do: modifiers in their order, then the key', () => {
    expect(keyText('Mod-s', true)).toBe('⌘S');
    expect(keyText('Mod-Shift-d', true)).toBe('⇧⌘D');
    expect(keyText('Mod-Shift-Enter', true)).toBe('⇧⌘↵');
    expect(keyText('Mod-Alt-1', true)).toBe('⌥⌘1');
    expect(keyText('Mod-\\', true)).toBe('⌘\\');
    expect(keyText('Mod-,', true)).toBe('⌘,');
  });

  it('writes Windows’ and Linux’s with words and pluses', () => {
    expect(keyText('Mod-s', false)).toBe('Ctrl+S');
    expect(keyText('Mod-Shift-\\', false)).toBe('Ctrl+Shift+\\');
    expect(keyText('Mod-Shift-Enter', false)).toBe('Ctrl+Shift+Enter');
  });

  it('takes "-" as a key, not a separator, at the end', () => {
    expect(keyText('Mod--', true)).toBe('⌘-');
    expect(keyText('Mod--', false)).toBe('Ctrl+-');
  });
});

describe('ariaKeys', () => {
  it('names the keys as aria-keyshortcuts does', () => {
    expect(ariaKeys('Mod-Shift-d', true)).toBe('Meta+Shift+D');
    expect(ariaKeys('Mod-Shift-d', false)).toBe('Control+Shift+D');
    expect(ariaKeys('Mod-Shift-Enter', true)).toBe('Meta+Shift+Enter');
  });
});

describe('keysOf', () => {
  it('takes the key for this system: the headings’ differ off a Mac', () => {
    const heading = { key: 'Mod-Alt-1', keyOffMac: 'Mod-Shift-1' };
    expect(keysOf(heading, true)).toEqual({ text: '⌥⌘1', aria: 'Meta+Alt+1' });
    expect(keysOf(heading, false)).toEqual({ text: 'Ctrl+Shift+1', aria: 'Control+Shift+1' });
    expect(keysOf({}, true)).toBeNull();
  });

  it('shows a run of keys as its first and last, and names each', () => {
    const run = { key: 'Mod-Alt-1', keyOffMac: 'Mod-Shift-1', keyThrough: '3' };
    expect(keysOf(run, true)).toEqual({
      text: '⌥⌘1–3',
      aria: 'Meta+Alt+1 Meta+Alt+2 Meta+Alt+3',
    });
    expect(keysOf(run, false)?.text).toBe('Ctrl+Shift+1–3');
  });
});
