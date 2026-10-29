// A page's own controls while the window is split, where the split's mode
// gives a note its own (../chrome/splits.ts): Facing pages' folio on each
// page, a companion's head on the second. A host per page holding the mode's
// own commands for its kind of page (../chrome/commands.ts, `on`), each
// showing how it is for that page's note. A press in a page makes it the active one first (./page-side.ts
// hears the pointer and the keyboard go in), so its command acts on that note.

import { actsOn, type CommandId } from '../chrome/commands';
import { type CommandLook, Host, type HostDraw } from '../chrome/host';
import type { SplitSpec } from '../chrome/splits';
import type { Pages, Side } from './pages';

export interface PageHostsOf {
  readonly pages: Pages;
  readonly mac: boolean;
  /** How `id` looks for `side`'s note. */
  look(id: CommandId, side: Side): CommandLook;
  press(id: CommandId, opener: HTMLElement): void;
  /** Show the tooltips of a host just drawn. */
  watch(host: HTMLElement): void;
}

export interface PageHosts {
  /** Each page given its host, or none, as the pages and the mode are now. */
  sync(): void;
  /** Each host shows how its commands are now. */
  refresh(): void;
}

export function pageHosts(of: PageHostsOf): PageHosts {
  /** Each page's host, and the mode it was drawn for: a closed page's goes with it. */
  const hosts = new WeakMap<Side, { readonly host: Host<HostDraw>; readonly mode: SplitSpec }>();
  const drawn = () => of.pages.sides.flatMap((side) => hosts.get(side)?.host ?? []);
  return {
    sync() {
      const { mode, split, sides } = of.pages;
      const { on, at } = mode.own;
      sides.forEach((side, index) => {
        // A side keeps its kind (another kind takes its place as a new side, drawn anew).
        const items = mode.own.items.filter((id) => actsOn(id, side.kind));
        const wanted = split && items.length > 0 && (on === 'each' || index === 1);
        const had = hosts.get(side);
        if (had && (!wanted || had.mode !== mode)) {
          had.host.element.remove();
          hosts.delete(side);
        }
        if (!wanted || hosts.has(side)) return;
        const host = new Host<HostDraw>(
          { name: 'page-own', label: side.kind === 'note' ? 'This note' : 'This book', items },
          { mac: of.mac, look: (id) => of.look(id, side), press: of.press },
        );
        (at === 'head' ? side.page.head : side.page.folio).tools.replaceChildren(host.element);
        of.watch(host.element);
        hosts.set(side, { host, mode });
      });
    },
    refresh() {
      for (const host of drawn()) host.refresh();
    },
  };
}
