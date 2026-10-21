// A host draws a list of commands as icon buttons, each with its name, its
// key and its tooltip (./tooltip.ts), and shows how each looks now. It
// knows nothing of what the commands do, or of which layout it's in.

import { h } from '../dom';
import { type IconName, icon } from '../icons';
import { type CommandId, commandOf } from './commands';
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
}

export class Host {
  readonly element: HTMLElement;
  readonly spec: HostSpec;
  readonly #of: HostOf;
  readonly #buttons = new Map<CommandId, HTMLButtonElement>();

  constructor(spec: HostSpec, of: HostOf) {
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
    this.element = h(
      'div',
      {
        class: `host host--${spec.name}`,
        attrs: { role: 'toolbar', 'aria-label': spec.label },
        on: { keydown: (event) => this.#arrow(event) },
      },
      ...items,
    );
    this.refresh();
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

  /** A toolbar's arrows: the next or last button in sight, as Tab would reach it. */
  #arrow(event: KeyboardEvent): void {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const shown = [...this.#buttons.values()].filter(
      (button) => !button.disabled && button.checkVisibility(),
    );
    const at = shown.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    shown[(at + step + shown.length) % shown.length]?.focus();
  }
}
