import { describe, expect, it } from 'vitest';
import { MemoryStorage } from './memory/memory-storage';
import { OpenVault } from './open-vault';

/** A storage whose watcher hears nothing until `start`: a phone's first look, macOS's first moments. */
class LateWatcher extends MemoryStorage {
  #start: () => void = () => undefined;

  override watch(onChange: (paths: string[]) => void, ready?: () => void): () => void {
    let stop: () => void = () => undefined;
    this.#start = () => {
      stop = super.watch(onChange);
      ready?.();
    };
    return () => stop();
  }

  start(): void {
    this.#start();
  }
}

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

  it('tells of what changed while it was being read, before anything watched', async () => {
    // Syncthing brings a note in while a phone reads its vault for the first time: no watcher
    // has started yet, and the next look takes the vault as it is now for its starting point.
    const storage = new MemoryStorage();
    storage.put('One.md', 'one');
    const vault = await OpenVault.open('Ink', storage);
    storage.put('Two.md', 'synced in meanwhile');
    const heard: string[] = [];
    vault.watch((paths) => heard.push(...paths));
    await expect.poll(() => heard).toEqual(['Two.md']);
    expect(
      vault
        .notes()
        .map((note) => note.path)
        .sort(),
    ).toEqual(['One.md', 'Two.md']);
  });

  it('looks again only once the watcher is listening, so nothing falls between them', async () => {
    const storage = new LateWatcher();
    storage.put('One.md', 'one');
    const vault = await OpenVault.open('Ink', storage);
    const heard: string[] = [];
    vault.watch((paths) => heard.push(...paths));
    storage.put('Two.md', 'while the watcher was starting');
    storage.start();
    await expect.poll(() => heard).toEqual(['Two.md']);
  });

  it('says nothing when nothing changed while it opened', async () => {
    const storage = new MemoryStorage();
    storage.put('One.md', 'one');
    const vault = await OpenVault.open('Ink', storage);
    const heard: string[] = [];
    vault.watch((paths) => heard.push(...paths));
    await new Promise((settle) => setTimeout(settle, 50));
    expect(heard).toEqual([]);
  });
});
