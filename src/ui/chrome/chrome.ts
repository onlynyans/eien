// The window's chrome: the layout chosen (appearance.layout), drawn as its
// hosts in the window's slots. Switching layouts takes one layout's hosts out
// and puts the other's in; nothing else changes. A command pressed runs the
// menu's command it sends, or one of the window's own.

import type { MenuCommand } from '../../platform/bridge';
import { type CommandId, commandOf, type Layout, type LocalCommandId } from './commands';
import { Host, type HostOf } from './host';
import type { SlotName } from './layout-spec';
import { LAYOUT_SPECS } from './layouts';

export interface ChromeOf extends Omit<HostOf, 'press'> {
  readonly slots: Readonly<Record<SlotName, HTMLElement>>;
  /** Run the menu's command (../menu/menu-bus.ts). */
  send(command: MenuCommand): void;
  /** Run one of the window's own commands; `opener` is the button pressed. */
  local(id: LocalCommandId, opener: HTMLElement): void;
  /** The keyboard was on a control the new layout doesn't draw: give it a place. */
  lost(): void;
}

export class Chrome {
  readonly #of: ChromeOf;
  readonly #hostOf: HostOf;
  #hosts: Host[] = [];
  #layout: Layout | null = null;

  constructor(of: ChromeOf) {
    this.#of = of;
    this.#hostOf = {
      mac: of.mac,
      look: (id) => of.look(id),
      press: (id, opener) => this.press(id, opener),
    };
  }

  get layout(): Layout | null {
    return this.#layout;
  }

  /** Draw `layout`'s hosts in place of the last one's; the keyboard stays on the same command. */
  mount(layout: Layout): void {
    if (layout === this.#layout) return;
    const active = document.activeElement;
    const held =
      active instanceof HTMLElement && this.#hosts.some((host) => host.element.contains(active))
        ? (active.dataset.command as CommandId | undefined)
        : undefined;
    this.unmount();
    const spec = LAYOUT_SPECS[layout];
    this.#hosts = [...spec.desktop, spec.phone].map((each) => new Host(each, this.#hostOf));
    for (const host of this.#hosts) {
      const slot = this.#of.slots[host.spec.slot];
      if (host.spec.first) slot.prepend(host.element);
      else slot.append(host.element);
    }
    this.#layout = layout;
    if (active instanceof HTMLElement && !active.isConnected) {
      const twin = held
        ? this.#hosts.map((host) => host.button(held)).find((button) => button?.checkVisibility())
        : undefined;
      if (twin) twin.focus();
      else this.#of.lost();
    }
  }

  /** Take the hosts out of the window. */
  unmount(): void {
    for (const host of this.#hosts) host.element.remove();
    this.#hosts = [];
    this.#layout = null;
  }

  /** Run `id`, as its button does. */
  press(id: CommandId, opener: HTMLElement): void {
    const sends = commandOf(id).sends;
    if (sends) this.#of.send(sends);
    else this.#of.local(id as LocalCommandId, opener);
    // What it changed shows once it's done: a menu command is heard by others first.
    queueMicrotask(() => this.refresh());
  }

  /** Show every command as it is now. */
  refresh(): void {
    for (const host of this.#hosts) host.refresh();
  }

  /** The buttons drawn for `id` in this layout (one on the desktop's window, maybe one on a phone's). */
  buttons(id: CommandId): HTMLButtonElement[] {
    return this.#hosts.flatMap((host) => host.button(id) ?? []);
  }
}
