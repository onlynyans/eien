// Each page's own controls while the window is split, where the split's mode
// gives each note its own (../chrome/splits.ts; Facing pages' folio): a host
// per page holding the mode's own commands, each showing how it is for that
// page's note. A press in a page makes it the active one first (./page-side.ts
// hears the pointer and the keyboard go in), so its command acts on that note.

import type { CommandId } from '../chrome/commands';
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
      const mode = of.pages.mode;
      const wanted = of.pages.split && mode.own.length > 0;
      for (const side of of.pages.sides) {
        const had = hosts.get(side);
        if (had && (!wanted || had.mode !== mode)) {
          had.host.element.remove();
          hosts.delete(side);
        }
        if (!wanted || hosts.has(side)) continue;
        const host = new Host<HostDraw>(
          { name: 'page-own', label: 'This page', items: mode.own },
          { mac: of.mac, look: (id) => of.look(id, side), press: of.press },
        );
        side.page.folio.tools.replaceChildren(host.element);
        of.watch(host.element);
        hosts.set(side, { host, mode });
      }
    },
    refresh() {
      for (const host of drawn()) host.refresh();
    },
  };
}
