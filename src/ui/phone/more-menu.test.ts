// The phone's ⋯ (spec §10) offers the quick look (#49), as the desktop's
// View → Look… does, next to Settings.

import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/config';
import type { MenuItem } from '../menu/menu';
import { moreItems } from './more-menu';

const words = (items: readonly MenuItem[]) =>
  items.map((item) => (item === 'separator' ? '—' : item.label));

describe('the phone’s ⋯', () => {
  it('has Look, just before Settings, running the quick look’s command', () => {
    const run = vi.fn();
    const items = moreItems(
      { values: DEFAULT_SETTINGS, sprinting: false, exportTo: () => {} },
      run,
    );
    expect(words(items).slice(-3)).toEqual(['—', 'Look', 'Settings']);
    const look = items.find((item) => item !== 'separator' && item.label === 'Look');
    if (look && look !== 'separator') look.run();
    expect(run).toHaveBeenCalledWith('look');
  });
});

describe('the ⋯ with a book in front (#40)', () => {
  it('keeps a note’s own choices there, disabled; Find and Settings stay', () => {
    const items = moreItems(
      { values: DEFAULT_SETTINGS, sprinting: false, exportTo: () => {}, kind: 'epub' },
      () => {},
    ).filter((item) => item !== 'separator');
    const disabled = (label: string) =>
      items.find((item) => item.label === label)?.disabled ?? false;
    for (const label of [
      'Seal',
      'Compare',
      'Versions',
      'Outline cards',
      'Copy as HTML',
      'Export…',
      'Focus mode',
      'Look',
    ]) {
      expect(disabled(label), label).toBe(true);
    }
    expect(disabled('Find')).toBe(false);
    expect(disabled('Settings')).toBe(false);
  });
});
