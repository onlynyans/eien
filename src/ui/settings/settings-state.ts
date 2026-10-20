// The settings as the window knows them: read through the bridge, changed
// through it, and announced to whatever draws from them.

import type { SettingKey, SettingValues } from '../../core/config';
import type { SettingsBridge } from '../../platform/bridge';

type Listener = (values: SettingValues, before: SettingValues) => void;

export class SettingsState {
  readonly #bridge: SettingsBridge;
  readonly #listeners = new Set<Listener>();
  #values: SettingValues;
  /** Counts changes, so an answer to an older one doesn't undo a newer one. */
  #turn = 0;

  private constructor(bridge: SettingsBridge, values: SettingValues) {
    this.#bridge = bridge;
    this.#values = values;
  }

  static async load(bridge: SettingsBridge): Promise<SettingsState> {
    return new SettingsState(bridge, await bridge.read());
  }

  get values(): SettingValues {
    return this.#values;
  }

  /** Read them again: after a vault opens, or its settings file changes. */
  async reload(): Promise<void> {
    this.#take(await this.#bridge.read());
  }

  /**
   * Change one setting. It shows at once; the main process's answer then
   * stands, unless a later change has been made meanwhile. Rejects, with the
   * reason, when it can't be kept, and shows what is kept instead.
   */
  async set<K extends SettingKey>(key: K, value: SettingValues[K]): Promise<void> {
    const turn = ++this.#turn;
    this.#take({ ...this.#values, [key]: value });
    try {
      const kept = await this.#bridge.set(key, value);
      if (turn === this.#turn) this.#take(kept);
    } catch (error) {
      this.#take(await this.#bridge.read());
      throw error;
    }
  }

  /** Hear every change; returns a function to stop. */
  onChange(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #take(values: SettingValues): void {
    const before = this.#values;
    this.#values = values;
    for (const listener of this.#listeners) listener(values, before);
  }
}
