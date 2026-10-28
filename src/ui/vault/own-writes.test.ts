import { describe, expect, it, vi } from 'vitest';
import type { Bridge, VaultBridge } from '../../platform/bridge';
import { OWN_ECHO_MS, ownWrites, withOwnWrites } from './own-writes';

/** A bridge as a class, its methods on the prototype (the phone's is one). */
class FakeVault {
  async write() {
    return { ok: true } as never;
  }
  async move() {
    return { ok: true } as never;
  }
  async trash() {}
  async makeFolder() {}
  async writeNew() {
    return true;
  }
  async importFolder() {
    return null;
  }
  async current() {
    return { name: 'Vault' };
  }
  onChange() {
    return () => {};
  }
}
const fake = () => new FakeVault() as unknown as VaultBridge;

describe('ownWrites', () => {
  it('a note this window wrote, heard back from the watcher, is its own; another isn’t', async () => {
    let now = 0;
    const own = ownWrites(fake(), () => now);
    await own.vault.write('Ideas.md', 'x', null);
    now += 1000;
    expect(own.foreign(['Ideas.md', 'Thaw.md'])).toEqual(['Thaw.md']);
  });

  it('a write’s echo is its own only for a moment: a later change there is from elsewhere', async () => {
    let now = 0;
    const own = ownWrites(fake(), () => now);
    await own.vault.write('Ideas.md', 'x', null);
    now += OWN_ECHO_MS + 1;
    expect(own.foreign(['Ideas.md'])).toEqual(['Ideas.md']);
  });

  it('a folder moved here: the notes in it, at both names, are its own', async () => {
    const own = ownWrites(fake(), () => 0);
    await own.vault.move('Fic', 'Fiction');
    expect(own.foreign(['Fic/A.md', 'Fiction/A.md', 'Other/B.md'])).toEqual(['Other/B.md']);
  });

  it('only notes count: settings, seals and hidden files never say another device wrote', () => {
    const own = ownWrites(fake(), () => 0);
    expect(
      own.foreign(['.eien/config.json', '.eien/versions/X/1.md', 'Fic/.eien-folder.json']),
    ).toEqual([]);
  });

  it('an import’s many files are its own, while it runs and a moment after', async () => {
    let now = 0;
    const own = ownWrites(fake(), () => now);
    let done = () => {};
    const vault = fake();
    vault.importFolder = vi.fn(() => new Promise<null>((resolve) => (done = () => resolve(null))));
    const importing = ownWrites(vault, () => now);
    const running = importing.vault.importFolder();
    expect(importing.foreign(['New.md'])).toEqual([]);
    done();
    await running;
    now += OWN_ECHO_MS + 1;
    expect(importing.foreign(['New.md'])).toEqual(['New.md']);
    expect(own.foreign(['New.md'])).toEqual(['New.md']);
  });

  it('keeps a class bridge’s own methods: current, onChange', async () => {
    const own = ownWrites(fake());
    expect(await own.vault.current()).toEqual({ name: 'Vault' });
    expect(typeof own.vault.onChange(() => {})).toBe('function');
  });
});

describe('ownWrites, with other windows on this device', () => {
  it('a note another window here wrote, as the main process says, isn’t from elsewhere', () => {
    const own = ownWrites(fake(), () => 0);
    expect(own.foreign(['Ideas.md', 'Thaw.md'], ['Ideas.md'])).toEqual(['Thaw.md']);
  });
});

describe('withOwnWrites', () => {
  /** A bridge as a class, as the phone's is: its methods on the prototype. */
  class FakeBridge {
    readonly platform = 'linux';
    readonly vault: VaultBridge;
    #heard: ((paths: string[], local?: string[]) => void) | null = null;
    constructor() {
      const vault = fake();
      vault.onChange = (listener) => {
        this.#heard = listener as never;
        return () => {
          this.#heard = null;
        };
      };
      this.vault = vault;
    }
    onBack() {
      return () => {};
    }
    changed(paths: string[]) {
      this.#heard?.(paths);
    }
  }

  it('keeps the bridge’s own methods, its vault the one that remembers', async () => {
    const given = new FakeBridge();
    const { bridge } = withOwnWrites(given as unknown as Bridge);
    expect(bridge.platform).toBe('linux');
    expect(typeof bridge.onBack).toBe('function');
    expect(bridge.vault).not.toBe(given.vault);
  });

  it('hears a change that came from elsewhere, not one of its own, till stopped', async () => {
    const given = new FakeBridge();
    const { bridge, onForeign } = withOwnWrites(given as unknown as Bridge);
    const heard = vi.fn();
    const stop = onForeign(heard);
    await bridge.vault.write('Mine.md', 'x', null);
    given.changed(['Mine.md']);
    expect(heard).not.toHaveBeenCalled();
    given.changed(['Thaw.md']);
    expect(heard).toHaveBeenCalledTimes(1);
    stop();
    given.changed(['Thaw.md']);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
