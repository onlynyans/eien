// The phone's vault, as the window asks of it (the VaultBridge in
// platform/bridge.ts): the same OpenVault the desktop's main process serves,
// here called directly. It opens once the folder may be used, after what a
// crash left is recovered, and is looked at again when the app comes back.

import type { VaultBridge, VaultInfo } from '../../platform/bridge';
import { CapacitorStorage } from '../../platform/capacitor/capacitor-storage';
import { recoverStrays } from '../../platform/capacitor/recover';
import { OpenVault } from '../../platform/open-vault';
import { VAULT_FOLDER, type VaultHome } from './vault-home';

export class MobileVault implements VaultBridge {
  readonly #home: VaultHome;
  /** Whether to look for changes now: false while the app is in the background. */
  readonly #active: () => boolean;
  readonly #listeners = new Set<(paths: string[]) => void>();
  #open: OpenVault | null = null;
  #storage: CapacitorStorage | null = null;
  #opening: Promise<VaultInfo | null> | null = null;

  constructor(home: VaultHome, active: () => boolean) {
    this.#home = home;
    this.#active = active;
  }

  /** The vault open now, or null (for the settings kept in it). */
  get open(): OpenVault | null {
    return this.#open;
  }

  current(): Promise<VaultInfo | null> {
    if (this.#open) return Promise.resolve({ name: this.#open.name });
    this.#opening ??= this.#openNow().finally(() => {
      this.#opening = null;
    });
    return this.#opening;
  }

  /** There's one place for the vault on the phone: choosing it is asking for the access. */
  async choose(): Promise<VaultInfo | null> {
    if (!(await this.#home.allowed()) && !(await this.#home.ask())) return null;
    return this.current();
  }

  async #openNow(): Promise<VaultInfo | null> {
    if (!(await this.#home.allowed())) return null;
    const files = this.#home.files;
    await files.makeFolder('');
    const storage = new CapacitorStorage(files, { active: this.#active });
    await recoverStrays(files, storage);
    const vault = await OpenVault.open(VAULT_FOLDER, storage);
    vault.watch((paths) => {
      for (const listener of this.#listeners) listener(paths);
    });
    this.#open = vault;
    this.#storage = storage;
    return { name: vault.name };
  }

  /** Look for changes now: the app is back, and another device may have written. */
  lookNow(): void {
    this.#storage?.lookNow();
  }

  #vault(): OpenVault {
    if (!this.#open) throw new Error('No vault is open.');
    return this.#open;
  }

  // Async, as over IPC: a call with no vault open rejects rather than throwing.
  list = async () => this.#vault().list();
  notes = async () => this.#vault().notes();
  search = async (query: string) => this.#vault().search(query);
  listFiles = async (folder: string) => this.#vault().listFiles(folder);
  read = async (path: string) => this.#vault().read(path);
  readBytes = async (path: string) => this.#vault().readBytes(path);
  write = async (path: string, text: string, expected: string | null) =>
    this.#vault().write(path, text, expected);
  move = async (from: string, to: string) => this.#vault().move(from, to);
  trash = async (path: string) => this.#vault().trash(path);
  makeFolder = async (path: string) => this.#vault().makeFolder(path);

  onChange(listener: (paths: string[]) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
