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
