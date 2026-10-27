// A host draws a list of commands as icon buttons, each with its name, its
// key and its tooltip (./tooltip.ts), and shows how each looks now; short of
// room in its bar, the ones it may fold go behind a ⋯ (./fold.ts). It knows
// nothing of what the commands do, or of which layout it's in.

import { h } from '../dom';
import { type IconName, icon } from '../icons';
import { type CommandId, commandOf } from './commands';
import type { Folding, Step } from './fold';
import { keysOf } from './keys';
import type { HostSpec } from './layout-spec';

/** How a command looks right now; what's left out is as its definition has it. */
export interface CommandLook {
  /** On or off, for a command that is one or the other (a view, Focus mode). */
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly icon?: IconName;
  /** The tooltip's words now (Compare · Changes). */
  readonly tip?: string;
}

export interface HostOf {
  readonly mac: boolean;
  look(id: CommandId): CommandLook;
  /** A button pressed: `opener` is the button, for what opens under it (the phone's ⋯). */
  press(id: CommandId, opener: HTMLElement): void;
  /** Its ⋯ pressed: the bar's folded tools, as a menu under it (./chrome.ts). */
  more?(opener: HTMLElement): void;
}

/** What a host draws: its name, label and commands; where it goes is its owner's (a layout's slot, a page). */
export type HostDraw = Pick<HostSpec, 'name' | 'label' | 'items' | 'icons' | 'folds'>;

export class Host<Spec extends HostDraw = HostSpec> implements Folding {
  readonly element: HTMLElement;
  readonly spec: Spec;
  readonly #of: HostOf;
  readonly #buttons = new Map<CommandId, HTMLButtonElement>();
  /** The ⋯ its bar's folded tools go behind, for a host that folds and is the bar's last. */
  readonly more: HTMLButtonElement | null;

  constructor(spec: Spec, of: HostOf) {
    this.spec = spec;
    this.#of = of;
    const items = spec.items.map((item) =>
      item === '|'
        ? h('span', { class: 'host__rule', attrs: { 'aria-hidden': 'true' } })
        : typeof item === 'string'
          ? this.#button(item)
          : h(
              'div',
              { class: 'host__group', attrs: { role: 'group', 'aria-label': item.group } },
              ...item.ids.map((id) => this.#button(id)),
            ),
    );
    this.more = spec.folds ? this.#moreButton() : null;
    this.element = h(
      'div',
      {
        class: `host host--${spec.name}`,
        attrs: {
          role: 'toolbar',
          'aria-label': spec.label,
          'data-folds': spec.folds ? '' : undefined,
        },
        on: { keydown: (event) => this.#arrow(event) },
      },
      ...items,
      this.more,
    );
    this.refresh();
  }

  /**
   * What may fold here, first to fold first, of what's drawn now (a command this layout or the
   * split hides isn't a tool to offer); a group's commands (the views) as one step.
   */
  steps(): Step[] {
    const folds = this.spec.folds ?? [];
    const order = folds.filter((id) => this.#buttons.get(id)?.checkVisibility());
    const steps = [...new Set(order.map((id) => this.#groupOf(id)?.ids ?? [id]))];
    // A group's step comes when the first of its commands would.
    const rank = (ids: readonly CommandId[]) =>
      Math.min(...ids.map((id) => folds.indexOf(id)).filter((at) => at >= 0));
    return steps.map((ids) => ({ ids, rank: rank(ids) }));
  }

  /** Its commands, in its order. */
  commands(): CommandId[] {
    return [...this.#buttons.keys()];
  }

  /** Show all but `ids`, folded behind a ⋯ (shown if `more`), and the rules that still part two runs. */
  fold(ids: readonly CommandId[], more: boolean): void {
    // Each written only when it changes, as in refresh: a write restyles, and a fit tries many.
    const hide = (element: HTMLElement, hidden: boolean) => {
      if (element.hidden !== hidden) element.hidden = hidden;
    };
    for (const [id, button] of this.#buttons) hide(button, ids.includes(id));
    if (this.more) hide(this.more, !more);
    for (const group of this.element.querySelectorAll<HTMLElement>('.host__group')) {
      hide(
        group,
        [...group.querySelectorAll('button')].every((button) => button.hidden),
      );
    }
    let before = false; // a tool in sight since the last rule shown
    let rule: HTMLElement | null = null;
    for (const child of this.element.children) {
      if (!(child instanceof HTMLElement) || child === this.more) continue;
      if (child.classList.contains('host__rule')) {
        if (before) rule = child;
        else hide(child, true);
        before = false;
      } else if (!child.hidden) {
        if (rule) hide(rule, false); // a tool in sight on each side
        rule = null;
        before = true;
      }
    }
    if (rule) hide(rule, true); // a run before it, none after
  }

  /** The button drawn for `id`, if this host holds it. */
  button(id: CommandId): HTMLButtonElement | undefined {
    return this.#buttons.get(id);
  }

  /** Show each command as it is now: pressed, disabled, its icon, its tooltip. */
  refresh(): void {
    for (const [id, button] of this.#buttons) {
      const def = commandOf(id);
      const look = this.#of.look(id);
      // Each written only when it changes: a redraw runs this, and a write restyles.
      const pressed = look.pressed === undefined ? null : String(look.pressed);
      if (button.getAttribute('aria-pressed') !== pressed) {
        if (pressed === null) button.removeAttribute('aria-pressed');
        else button.setAttribute('aria-pressed', pressed);
      }
      const disabled = look.disabled ?? false;
      if (button.disabled !== disabled) button.disabled = disabled;
      const tip = look.tip ?? def.tip ?? def.label;
      if (button.dataset.tip !== tip) button.dataset.tip = tip;
      const name = this.spec.icons?.[id] ?? look.icon ?? def.icon;
      const drawn = button.querySelector<SVGElement>('svg')?.dataset.icon;
      if (name !== 'seal' && drawn !== name) button.replaceChildren(icon(name));
    }
  }

  #button(id: CommandId): HTMLButtonElement {
    const def = commandOf(id);
    const keys = keysOf(def, this.#of.mac);
    const button = h(
      'button',
      {
        class: def.icon === 'seal' ? 'icon-button icon-button--seal' : 'icon-button',
        attrs: {
          type: 'button',
          'data-command': id,
          'aria-label': def.label,
          'aria-keyshortcuts': keys?.aria,
          'data-shortcut': keys?.text,
          // Its identity across redraws and layouts: the keyboard comes back to it by this.
          'data-key': `command:${id}`,
          'aria-haspopup': id === 'settings' ? 'dialog' : id === 'more' ? 'menu' : undefined,
        },
        on: { click: () => this.#of.press(id, button) },
      },
      def.icon === 'seal'
        ? h('span', { class: 'seal', text: '永', attrs: { 'aria-hidden': 'true' } })
        : null,
    );
    this.#buttons.set(id, button);
    return button;
  }

  /** The group `id` is one of (the views), as the spec has it: the same array each time. */
  #groupOf(id: CommandId): { readonly ids: readonly CommandId[] } | undefined {
    for (const item of this.spec.items)
      if (typeof item === 'object' && item.ids.includes(id)) return item;
    return undefined;
  }

  /** The ⋯: the bar's folded tools, as a menu its owner opens under it. */
  #moreButton(): HTMLButtonElement {
    const more: HTMLButtonElement = h(
      'button',
      {
        class: 'icon-button host__more',
        attrs: {
          type: 'button',
          hidden: true,
          'aria-label': 'More tools',
          'aria-haspopup': 'menu',
          'data-tip': 'More tools',
          'data-key': `fold:${this.spec.name}`,
        },
        on: { click: () => this.#of.more?.(more) },
      },
      icon('more'),
    );
    return more;
  }

  /** A toolbar's arrows: the next or last button in sight, as Tab would reach it (the ⋯ too). */
  #arrow(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const shown = [...this.element.querySelectorAll('button')].filter(
      (button) => !button.disabled && !button.hidden && button.checkVisibility(),
    );
    const at = shown.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    shown[(at + step + shown.length) % shown.length]?.focus();
  }
}
