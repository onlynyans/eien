import { describe, expect, it } from 'vitest';
import { MemoryStorage } from './memory/memory-storage';
import { OpenVault } from './open-vault';

describe('OpenVault', () => {
  it('keeps its index in step with every change made through it', async () => {
    const storage = new MemoryStorage();
    storage.put('One.md', 'one');
    const vault = await OpenVault.open('Ink', storage);
    expect((await vault.notes()).map((note) => note.path)).toEqual(['One.md']);
    await vault.write('Two.md', 'two words', null);
    await vault.makeFolder('Book');
    await vault.move('One.md', 'Book/One.md');
    expect((await vault.notes()).map((note) => note.path).sort()).toEqual([
      'Book/One.md',
      'Two.md',
    ]);
    await vault.trash('Two.md');
    expect((await vault.notes()).map((note) => note.path)).toEqual(['Book/One.md']);
    expect((await vault.search('one')).hits.map((hit) => hit.path)).toEqual(['Book/One.md']);
  });

  it('leaves the index as it was when a change is refused', async () => {
    const storage = new MemoryStorage();
    storage.put('One.md', 'one');
    const vault = await OpenVault.open('Ink', storage);
    expect((await vault.write('One.md', 'clash', null)).ok).toBe(false);
    expect((await vault.move('None.md', 'X.md')).ok).toBe(false);
    expect((await vault.notes()).map((note) => note.words)).toEqual([1]);
  });
});
