// The window's chrome: the layout chosen (appearance.layout), drawn as its
// hosts in the window's slots. Switching layouts takes one layout's hosts out
// and puts the other's in; nothing else changes. A command pressed runs the
// menu's command it sends, or one of the window's own. Short of room, a host
// folds its tools behind a ⋯ (./fold.ts), fitted whenever its bar's room
// changes.

import type { MenuCommand } from '../../platform/bridge';
import { openMenu } from '../menu/menu';
import { type CommandId, commandOf, type Layout, type LocalCommandId } from './commands';
import { fitBar, foldMenu } from './fold';
import { Host, type HostOf } from './host';
import type { SlotName } from './layout-spec';
import { LAYOUT_SPECS } from './layouts';
import { type SplitSpec, splitHosts } from './splits';

export interface ChromeOf extends Omit<HostOf, 'press'> {
  readonly slots: Readonly<Record<SlotName, HTMLElement>>;
  /** Run the menu's command (../menu/menu-bus.ts), for the control `id` pressed. */
  send(command: MenuCommand, id: CommandId): void;
  /** Run one of the window's own commands; `opener` is the button pressed. */
  local(id: LocalCommandId, opener: HTMLElement): void;
  /** The keyboard was on a control the new layout doesn't draw: give it a place. */
  lost(): void;
  /** Show the tooltips of a host just drawn (./tooltip.ts). */
  watch(host: HTMLElement): void;
  /** The split's pager, folded (../page/page-pane.ts): placed where the layout says. */
  readonly pager?: HTMLElement;
  /**
   * Whether the window goes the phone's way, its desktop bars out of sight: the pager then stands
   * with the phone's tools (Two pages, folded).
   */
  readonly phone?: () => boolean;
  /** Whether a host fits its bar as drawn now: ./fold.ts measures it (tests say, with no layout). */
  readonly fits?: (host: HTMLElement, bar: HTMLElement) => boolean;
}

export class Chrome {
  readonly #of: ChromeOf;
  readonly #hostOf: HostOf;
  #hosts: Host[] = [];
  #layout: Layout | null = null;
  /** The split the hosts were drawn for: none with one page. */
  #split: SplitSpec | null = null;
  /**
   * Watches the bars the folding hosts stand in, whose room the page and the window give them:
   * folding changes a host, never its bar, so fitting never makes it fire again.
   */
  readonly #bars =
    typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.fit());
  /** What each bar has folded behind its ⋯, in its order. */
  readonly #folded = new Map<HTMLElement, readonly CommandId[]>();

  constructor(of: ChromeOf) {
    this.#of = of;
    this.#hostOf = {
      mac: of.mac,
      look: (id) => of.look(id),
      press: (id, opener) => this.press(id, opener),
      more: (opener) => this.#more(opener),
    };
  }

  get layout(): Layout | null {
    return this.#layout;
  }

  /**
   * Draw `layout`'s hosts in place of the last one's, as `split` has them
   * while the window is split; the keyboard stays on the same command.
   */
  mount(layout: Layout, split: SplitSpec | null = null): void {
    if (layout === this.#layout && split === this.#split) return;
    const active = document.activeElement;
    const held =
      active instanceof HTMLElement && this.#hosts.some((host) => host.element.contains(active))
        ? (active.dataset.command as CommandId | undefined)
        : undefined;
    this.unmount();
    const spec = LAYOUT_SPECS[layout];
    this.#hosts = [...splitHosts(spec, split), spec.phone].map(
      (each) => new Host(each, this.#hostOf),
    );
    for (const host of this.#hosts) {
      const slot = this.#of.slots[host.spec.slot];
      if (host.spec.first) slot.prepend(host.element);
      else slot.append(host.element);
      this.#of.watch(host.element);
    }
    this.#layout = layout;
    this.#placePager();
    this.#split = split;
    for (const host of this.#hosts) {
      const bar = host.element.parentElement;
      if (host.spec.folds && bar) this.#bars?.observe(bar);
    }
    // The split's pager stands in the tools' bar: drawn or not, it changes their room, not the bar's.
    if (this.#of.pager) this.#bars?.observe(this.#of.pager);
    this.fit();
    if (active instanceof HTMLElement && !active.isConnected) {
      // The same command in the new layout, or the ⋯ it's folded behind there.
      const twin = held ? this.inSight(held) : undefined;
      if (twin) twin.focus();
      else this.#of.lost();
    }
  }

  /** Take the hosts out of the window. */
  unmount(): void {
    this.#bars?.disconnect();
    this.#folded.clear();
    for (const host of this.#hosts) host.element.remove();
    this.#hosts = [];
    this.#layout = null;
    this.#split = null;
  }

  /** Run `id`, as its button does. */
  press(id: CommandId, opener: HTMLElement): void {
    const sends = commandOf(id).sends;
    if (sends) this.#of.send(sends, id);
    else this.#of.local(id as LocalCommandId, opener);
    // What it changed shows once it's done: a menu command is heard by others first. The strip,
    // folded or opened, changes the slip's room with no resize: its hosts fit again.
    queueMicrotask(() => {
      this.refresh();
      if (id === 'strip') this.fit();
    });
  }

  /**
   * Fold each bar's tools as its room says now. A bar not drawn (a phone's) is left as it is; the
   * keyboard on a tool that folds goes to the ⋯ it went behind.
   */
  fit(): void {
    const bars = new Map<HTMLElement, Host[]>();
    for (const host of this.#hosts) {
      const bar = host.element.parentElement;
      if (host.spec.folds && bar) bars.set(bar, [...(bars.get(bar) ?? []), host]);
    }
    const had = document.activeElement;
    for (const [bar, hosts] of bars) {
      if (bar.getClientRects().length === 0) continue;
      this.#folded.set(bar, fitBar(hosts, bar, this.#of.fits));
      const more = hosts.at(-1)?.more;
      if (had instanceof HTMLElement && had.hidden && bar.contains(had)) more?.focus();
    }
  }

  /** The commands folded behind the ⋯ in `bar` now. */
  folded(bar: HTMLElement): readonly CommandId[] {
    return this.#folded.get(bar) ?? [];
  }

  /** The button for `id` in sight now, or the ⋯ it's folded behind: what opens under it. */
  inSight(id: CommandId): HTMLButtonElement | undefined {
    return this.#hosts
      .map((host) => {
        const button = host.button(id);
        return button?.hidden ? this.#moreOf(host) : button;
      })
      .find((button) => button?.checkVisibility()) as HTMLButtonElement | undefined;
  }

  /** The ⋯ the tools of `host`'s bar fold behind: its last folding host's. */
  #moreOf(host: Host): HTMLButtonElement | null {
    const bar = host.element.parentElement;
    const last = this.#hosts
      .filter((each) => each.spec.folds && each.element.parentElement === bar)
      .at(-1);
    return last?.more ?? null;
  }

  /** A ⋯ pressed: its bar's folded tools, as a menu under it. */
  #more(opener: HTMLElement): void {
    const bar = opener.closest('.host')?.parentElement;
    if (!bar) return;
    // A group's commands (the views) are one choice: radios, not toggles.
    const chosen = new Set(
      this.#hosts.flatMap((host) =>
        host.spec.items.flatMap((item) => (typeof item === 'object' ? item.ids : [])),
      ),
    );
    const press = (id: CommandId, from: HTMLElement) => this.press(id, from);
    const items = foldMenu(this.folded(bar), this.#of.look, press, opener, chosen);
    openMenu(items, { opener }, 'More tools');
  }

  /** Show every command as it is now. */
  refresh(): void {
    this.#placePager();
    for (const host of this.#hosts) host.refresh();
  }

  /** The pager before the page's tools: the layout's, or the phone's while it goes the phone's way. */
  #placePager(): void {
    const { pager, phone } = this.#of;
    const spec = this.#layout && LAYOUT_SPECS[this.#layout];
    if (!pager || !spec) return;
    const name = phone?.() ? spec.phone.name : spec.tools;
    const tools = this.#hosts.find((host) => host.spec.name === name);
    if (tools && pager.nextElementSibling !== tools.element) tools.element.before(pager);
  }

  /** The buttons drawn for `id` in this layout (one on the desktop's window, maybe one on a phone's). */
  buttons(id: CommandId): HTMLButtonElement[] {
    return this.#hosts.flatMap((host) => host.button(id) ?? []);
  }
}
