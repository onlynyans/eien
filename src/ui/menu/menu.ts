// A small menu that floats over the window (docs/design: raised paper, a
// hairline edge, the float shadow): a right-click's choices, or a list's
// sort. A row's menu is headed by the row's name, and each choice has an
// icon, a word and its key in pencil; a choice that throws away is in
// carmine, last (docs/design/explorations/overall.md). Arrows move, Enter
// chooses, Esc or a click elsewhere closes, and focus goes back where it was.

import { ariaKeys, keyText } from '../chrome/keys';
import { h } from '../dom';
import { type IconName, icon } from '../icons';

const MAC = /Mac|iPhone|iPad/.test(navigator.platform);
/** No keyboard to press them on: a phone's menu leaves the keys out. */
const touch = () => window.matchMedia('(pointer: coarse)').matches;

export type MenuItem =
  | {
      readonly label: string;
      readonly run: () => void;
      /** A choice of several, this one chosen: drawn with the ink dot. */
      readonly checked?: boolean;
      /** On or off by itself (Focus mode), not one of several: `checked` says which. */
      readonly toggle?: true;
      readonly disabled?: boolean;
      /** Indented under the one before (a folder inside a folder). */
      readonly depth?: number;
      readonly icon?: IconName;
      /** Its key, as CodeMirror writes keys ("F2", "Mod-Backspace"): shown in pencil, and named to assistive tech. */
      readonly keys?: string;
      /** It throws something away (to the trash): carmine. */
      readonly danger?: true;
    }
  | 'separator';

let open: { close(): void } | null = null;

/** Where something floats: at the pointer, or under the element that opened it. */
export interface Place {
  readonly at?: { x: number; y: number };
  readonly opener?: HTMLElement;
}

/**
 * Float `panel` at `place`, kept inside the window, as the one thing open:
 * whatever was open closes first. It closes on a click elsewhere, the
 * window losing focus or changing width (a shorter window moves it to stay
 * inside), or the close returned; then the
 * keyboard goes back where it was, and `closed` runs.
 */
export function float(panel: HTMLElement, place: Place, closed?: () => void): () => void {
  open?.close();
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const close = () => {
    if (open !== handle) return;
    open = null;
    panel.remove();
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('blur', close);
    window.removeEventListener('resize', resized);
    back?.focus();
    closed?.();
  };
  // A narrower or wider window moves things from under it: it closes. A taller or shorter one (a
  // phone's keyboard coming or going) keeps it open, moved to stay inside.
  const width = window.innerWidth;
  const resized = () => {
    if (window.innerWidth !== width) close();
    else placeIn();
  };
  const handle = { close };
  const outside = (event: Event) => {
    if (!panel.contains(event.target as Node)) close();
  };
  document.body.append(panel);
  open = handle;
  const anchor = place.opener?.getBoundingClientRect();
  const x = place.at?.x ?? anchor?.left ?? 0;
  const y = place.at?.y ?? (anchor ? anchor.bottom + 4 : 0);
  const placeIn = () => {
    const size = panel.getBoundingClientRect();
    panel.style.setProperty(
      '--menu-x',
      `${Math.max(4, Math.min(x, window.innerWidth - size.width - 4))}px`,
    );
    panel.style.setProperty(
      '--menu-y',
      `${Math.max(4, Math.min(y, window.innerHeight - size.height - 4))}px`,
    );
  };
  placeIn();
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('blur', close);
  window.addEventListener('resize', resized);
  return close;
}

/**
 * Show `items` at the pointer (`at`), or under `opener`. Only one menu is open at a time.
 * `head`: the menu is a row's, headed by its name (`label`).
 */
export function openMenu(
  items: readonly MenuItem[],
  place: Place,
  label = 'Choices',
  head = false,
): void {
  const buttons: HTMLButtonElement[] = [];
  const iconed = items.some((item) => item !== 'separator' && item.icon);
  const keyed = !touch();
  const menu = h('div', {
    class: iconed ? 'menu menu--icons' : 'menu',
    attrs: { role: 'menu', 'aria-label': label },
  });
  // The menu's name is already its label: the head is for the eye.
  if (head)
    menu.append(h('div', { class: 'menu__head', text: label, attrs: { 'aria-hidden': 'true' } }));
  let close = () => {};
  for (const item of items) {
    if (item === 'separator') {
      menu.append(h('div', { class: 'menu__rule', attrs: { role: 'separator' } }));
      continue;
    }
    const button = h('button', {
      class: item.danger ? 'word-button is-danger' : 'word-button',
      text: iconed ? undefined : item.label,
      attrs: {
        'aria-keyshortcuts': item.keys && keyed ? ariaKeys(item.keys, MAC) : undefined,
        type: 'button',
        role:
          item.checked === undefined
            ? 'menuitem'
            : item.toggle
              ? 'menuitemcheckbox'
              : 'menuitemradio',
        'aria-checked': item.checked === undefined ? undefined : String(item.checked),
        disabled: item.disabled ? true : undefined,
      },
      on: {
        click: () => {
          close();
          item.run();
        },
      },
    });
    if (iconed) {
      button.append(
        item.icon ? icon(item.icon) : h('span', { class: 'icon' }),
        h('span', { class: 'menu__word', text: item.label }),
        // Drawn by the style sheet (content: attr()), so a choice's words are its words alone.
        h('span', {
          class: 'menu__keys',
          attrs: {
            'aria-hidden': 'true',
            'data-keys': item.keys && keyed ? keyText(item.keys, MAC) : undefined,
          },
        }),
      );
    }
    if (item.depth) button.style.setProperty('--depth', String(item.depth));
    buttons.push(button);
    menu.append(button);
  }
  menu.addEventListener('keydown', (event) => {
    const enabled = buttons.filter((button) => !button.disabled);
    const at = enabled.indexOf(document.activeElement as HTMLButtonElement);
    const step = (by: number) => enabled[(at + by + enabled.length) % enabled.length]?.focus();
    if (event.key === 'ArrowDown') step(1);
    else if (event.key === 'ArrowUp') step(-1);
    else if (event.key === 'Home') enabled[0]?.focus();
    else if (event.key === 'End') enabled.at(-1)?.focus();
    else if (event.key === 'Escape' || event.key === 'Tab') close();
    else return;
    event.preventDefault();
    event.stopPropagation();
  });
  close = float(menu, place);

  // The choice made, of several (a sort); never a toggle, which Enter would turn off.
  (
    buttons.find(
      (button) =>
        button.getAttribute('role') === 'menuitemradio' &&
        button.getAttribute('aria-checked') === 'true',
    ) ?? buttons.find((b) => !b.disabled)
  )?.focus();
}

/** Close the menu that's open, if one is. */
/** Close the menu that's open; whether one was (the system's back closes it first). */
export function closeMenu(): boolean {
  if (!open) return false;
  open.close();
  return true;
}
