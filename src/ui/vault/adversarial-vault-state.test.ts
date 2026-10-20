// Adversarial: following a [[wiki link]] to a note whose file name is in the
// other Unicode normal form (names.ts: every system ignores the difference).

import { describe, expect, it } from 'vitest';
import type { VaultEntry } from '../../core/vault';
import { VaultState } from './vault-state';

const note = (path: string): VaultEntry => ({ path, kind: 'note', modified: 0, size: 0 });

async function stateWith(...paths: string[]) {
  const state = new VaultState(
    {
      list: async () => paths.map(note),
      notes: async () => [],
      search: async () => ({ total: 0, hits: [] }),
      read: async () => null,
    },
    'V',
  );
  await state.refresh();
  return state;
}

describe('findByTitle', () => {
  it('finds a decomposed file name from a link typed composed', async () => {
    const state = await stateWith('Café.md'); // as a Mac app may name it
    expect(state.findByTitle('Café')).toBe('Café.md'); // as a keyboard types it
  });

  it('finds a composed file name from a link pasted decomposed', async () => {
    const state = await stateWith('Café.md');
    expect(state.findByTitle('Café')).toBe('Café.md');
  });
});
