import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../../platform/memory/memory-storage';
import { OpenVault } from '../../platform/open-vault';
import { Vaults } from './vaults';

/** Folders in memory, opened as the main process opens one: each opening counted. */
function folders() {
  const storages = new Map<string, MemoryStorage>([
    ['/Vault', new MemoryStorage()],
    ['/Other', new MemoryStorage()],
  ]);
  const opened: string[] = [];
  const vaults = new Vaults(
    async (root) => {
      opened.push(root); // where a crash's leftovers are recovered, too
      const storage = storages.get(root);
      if (!storage) throw new Error(`No folder ${root}`);
      return { vault: await OpenVault.open(root, storage), root, syncthing: false };
    },
    async (root) => root.replace(/\/$/, ''), // "/Vault/" is "/Vault"
  );
  return { vaults, opened, storages };
}

/** Each change a window heard: the paths, and those another window here wrote. */
const ear = () => {
  const heard: [string[], string[]][] = [];
  return { heard, hear: (paths: string[], local: string[]) => heard.push([paths, local]) };
};
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the vaults the windows hold (New Window)', () => {
  it('opens a folder once, however many windows show it, and both see one index', async () => {
    const { vaults, opened } = folders();
    const a = await vaults.hold('/Vault', () => {});
    const b = await vaults.hold('/Vault/', () => {});
    expect(opened).toEqual(['/Vault']); // leftovers recovered once, before anyone wrote
    expect(b.vault).toBe(a.vault);
    expect(vaults.size).toBe(1);
  });

  it('opens two windows asking at once only once', async () => {
    const { vaults, opened } = folders();
    await Promise.all([vaults.hold('/Vault', () => {}), vaults.hold('/Vault', () => {})]);
    expect(opened).toEqual(['/Vault']);
  });

  it('tells each window which changes another window here made, and not its own', async () => {
    const { vaults } = folders();
    const earA = ear();
    const earB = ear();
    const a = await vaults.hold('/Vault', earA.hear);
    await vaults.hold('/Vault', earB.hear);
    a.wrote(['One.md']);
    await a.vault.write('One.md', 'Words.', null);
    await settle();
    expect(earA.heard).toEqual([[['One.md'], []]]);
    expect(earB.heard).toEqual([[['One.md'], ['One.md']]]);
  });

  it('keeps watching while one window holds the folder, and stops when the last lets go', async () => {
    const { vaults, opened, storages } = folders();
    const earB = ear();
    const a = await vaults.hold('/Vault', () => {});
    const b = await vaults.hold('/Vault', earB.hear);
    a.release();
    a.release(); // twice is once
    storages.get('/Vault')?.put('Two.md', 'From elsewhere.');
    await settle();
    expect(earB.heard).toEqual([[['Two.md'], []]]);
    b.release();
    expect(vaults.size).toBe(0);
    storages.get('/Vault')?.put('Three.md', 'Nobody hears.');
    await settle();
    expect(earB.heard).toHaveLength(1);
    await vaults.hold('/Vault', () => {}); // opened again, with nobody else writing
    expect(opened).toEqual(['/Vault', '/Vault']);
  });

  it('keeps each folder apart, and a folder that can’t be opened holds nothing', async () => {
    const { vaults } = folders();
    const a = await vaults.hold('/Vault', () => {});
    const b = await vaults.hold('/Other', () => {});
    expect(b.vault).not.toBe(a.vault);
    await expect(vaults.hold('/Missing', () => {})).rejects.toThrow('No folder /Missing');
    expect(vaults.size).toBe(2);
  });
});
