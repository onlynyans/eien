// Tools that don't fit their bar fold behind one ⋯ (the "priority+" way),
// rather than run past the page, the screen, or the system's window controls
// (backlog #36). A bar folds as one, across its hosts (A's views and tools),
// in the order its hosts' `folds` lists give (./layout-spec.ts), a group's
// commands (the views) as one step; the ⋯ is the bar's last host's. What no
// `folds` names never folds: the strip's toggle, the shut band's way back.

import type { MenuItem } from '../menu/menu';
import { type CommandId, commandOf } from './commands';
import type { CommandLook } from './host';

/** One step of folding: a command, or a group's (the views); `rank` its place in the order. */
export interface Step {
  readonly ids: readonly CommandId[];
  readonly rank: number;
}

/** A host as its bar folds it (./host.ts). */
export interface Folding {
  readonly element: HTMLElement;
  /** Its commands, in the bar's order. */
  commands(): readonly CommandId[];
  /** What may fold, of what's drawn now. */
  steps(): readonly Step[];
  /** Show all but `ids`, and its ⋯ only if `more`. */
  fold(ids: readonly CommandId[], more: boolean): void;
}

/** The fewest of `order` folded, first first, with which the bar `fits`; all of them if none fit. */
export function folded<T>(order: readonly T[], fits: (folded: readonly T[]) => boolean): T[] {
  for (let count = 0; count < order.length; count++) {
    if (fits(order.slice(0, count))) return order.slice(0, count);
  }
  return [...order];
}

/**
 * Fold `hosts`, the folding hosts of one bar in its order, as few as it takes for each to fit
 * `bar`, from all unfolded (its room may have grown); what folded, in the bar's order. The bar's
 * room is read with every tool in sight: a bar its tools size (a phone's, beside back and ⇄, which
 * give way first) is at its widest then, and folding would only narrow it.
 */
export function fitBar(
  hosts: readonly Folding[],
  bar: HTMLElement,
  given?: (host: HTMLElement, bar: HTMLElement) => boolean,
): CommandId[] {
  const last = hosts.at(-1);
  const apply = (ids: readonly CommandId[]) => {
    for (const host of hosts) host.fold(ids, host === last && ids.length > 0);
  };
  apply([]); // all in sight, to know what's drawn; folding none again below writes nothing
  const fits = given ?? within(contentBox(bar));
  const steps = hosts.flatMap((host) => host.steps()).sort((a, b) => a.rank - b.rank);
  const chosen = folded(steps, (some) => {
    apply(some.flatMap((step) => step.ids));
    return hosts.every((host) => fits(host.element, bar));
  }).flatMap((step) => step.ids);
  apply(chosen);
  return hosts.flatMap((host) => host.commands()).filter((id) => chosen.includes(id));
}

/**
 * The bar's content box, left to right: its padding keeps clear of the window's corner and the
 * system's controls, so inside it is clear of them too. The bar's, not a host's; read once a fit.
 */
export function contentBox(bar: HTMLElement): { readonly left: number; readonly right: number } {
  const box = bar.getBoundingClientRect();
  const style = getComputedStyle(bar);
  return {
    left:
      box.left + Number.parseFloat(style.borderLeftWidth) + Number.parseFloat(style.paddingLeft),
    right:
      box.right - Number.parseFloat(style.borderRightWidth) - Number.parseFloat(style.paddingRight),
  };
}

/** Whether everything of a host's in sight lies inside `box`, at both ends. */
export const within =
  (box: { readonly left: number; readonly right: number }) =>
  (host: HTMLElement): boolean => {
    for (const child of host.children) {
      if (!(child instanceof HTMLElement) || child.hidden) continue;
      const drawn = child.getBoundingClientRect();
      if (drawn.width === 0) continue; // not drawn: hidden by its layout (the split's tools)
      if (drawn.left < box.left - 0.5 || drawn.right > box.right + 0.5) return false;
    }
    return true;
  };

/**
 * The ⋯'s menu: each folded command its name, icon and key, run from the ⋯; on or off as its
 * button is, a toggle (Focus mode), or one of a choice (`chosen`: the views) with the dot.
 */
export function foldMenu(
  ids: readonly CommandId[],
  look: (id: CommandId) => CommandLook,
  press: (id: CommandId, opener: HTMLElement) => void,
  opener: HTMLElement,
  chosen: ReadonlySet<CommandId> = new Set(),
): MenuItem[] {
  return ids.map((id) => {
    const def = commandOf(id);
    const now = look(id);
    return {
      label: def.label,
      icon: def.icon === 'seal' ? undefined : (now.icon ?? def.icon),
      keys: def.key,
      disabled: now.disabled,
      ...(now.pressed === undefined
        ? {}
        : chosen.has(id)
          ? { checked: now.pressed }
          : { toggle: true as const, checked: now.pressed }),
      run: () => press(id, opener),
    };
  });
}
