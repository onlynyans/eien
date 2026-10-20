// A small menu that floats over the window (docs/design: raised paper, a
// hairline edge, the float shadow): a right-click's choices, or a list's
// sort. Arrows move, Enter chooses, Esc or a click elsewhere closes, and
// focus goes back where it was.

import { h } from '../dom';

export type MenuItem =
  | {
      readonly label: string;
      readonly run: () => void;
      /** A choice of several, this one chosen: drawn with the ink dot. */
      readonly checked?: boolean;
      readonly disabled?: boolean;
      /** Indented under the one before (a folder inside a folder). */
      readonly depth?: number;
    }
  | 'separator';

let open: { close(): void } | null = null;

/** Show `items` at the pointer (`at`), or under `opener`. Only one menu is open at a time. */
export function openMenu(
  items: readonly MenuItem[],
  place: { readonly at?: { x: number; y: number }; readonly opener?: HTMLElement },
  label = 'Choices',
): void {
  open?.close();
  const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const buttons: HTMLButtonElement[] = [];
  const menu = h('div', { class: 'menu', attrs: { role: 'menu', 'aria-label': label } });
  for (const item of items) {
    if (item === 'separator') {
      menu.append(h('div', { class: 'menu__rule', attrs: { role: 'separator' } }));
      continue;
    }
    const button = h('button', {
      class: 'word-button',
      text: item.label,
      attrs: {
        type: 'button',
        role: item.checked === undefined ? 'menuitem' : 'menuitemradio',
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
    if (item.depth) button.style.setProperty('--depth', String(item.depth));
    buttons.push(button);
    menu.append(button);
  }

  const close = () => {
    if (open !== handle) return;
    open = null;
    menu.remove();
    document.removeEventListener('pointerdown', outside, true);
    window.removeEventListener('blur', close);
    window.removeEventListener('resize', close);
    back?.focus();
  };
  const handle = { close };
  const outside = (event: Event) => {
    if (!menu.contains(event.target as Node)) close();
  };
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

  document.body.append(menu);
  open = handle;
  // Where it goes: at the pointer, or under its opener; kept inside the window.
  const anchor = place.opener?.getBoundingClientRect();
  const x = place.at?.x ?? anchor?.left ?? 0;
  const y = place.at?.y ?? (anchor ? anchor.bottom + 4 : 0);
  const size = menu.getBoundingClientRect();
  menu.style.setProperty(
    '--menu-x',
    `${Math.max(4, Math.min(x, window.innerWidth - size.width - 4))}px`,
  );
  menu.style.setProperty(
    '--menu-y',
    `${Math.max(4, Math.min(y, window.innerHeight - size.height - 4))}px`,
  );
  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('blur', close);
  window.addEventListener('resize', close);
  (
    buttons.find((button) => button.getAttribute('aria-checked') === 'true') ??
    buttons.find((b) => !b.disabled)
  )?.focus();
}

/** Close the menu that's open, if one is. */
export const closeMenu = (): void => open?.close();
