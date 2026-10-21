import { describe, expect, it } from 'vitest';
import { ariaKeys, keyText } from './keys';

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
