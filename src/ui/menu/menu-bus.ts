// The menu's commands inside the window. The menu bar's come through the
// bridge; a phone has none, and its ⋯ menu (../phone) sends the same
// commands here. Each is handled in one place, whoever sent it.

import type { Bridge, MenuCommand } from '../../platform/bridge';

export class MenuBus {
  readonly #listeners = new Set<(command: MenuCommand) => void>();

  constructor(bridge: Bridge) {
    bridge.onMenu((command) => this.run(command));
  }

  run(command: MenuCommand): void {
    for (const listener of [...this.#listeners]) listener(command);
  }

  /** Hear every command; returns a function to stop. */
  on(listener: (command: MenuCommand) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
