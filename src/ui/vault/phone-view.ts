// The vault on a phone (spec §10): one pane at a time (../phone/phone-stack.ts),
// back to the one before, and the page's ⋯ (the `more` command the layout
// draws, ../chrome) for what the menu bar offers on the desktop. Choosing a folder or tag shows its notes; opening a note
// shows the page, with the keyboard on its title, so reading a note doesn't
// bring up the phone's keyboard.

import type { MenuCommand } from '../../platform/bridge';
import { closeMenu, openMenu } from '../menu/menu';
import type { MenuBus } from '../menu/menu-bus';
import type { PageView } from '../page/page';
import { moreItems } from '../phone/more-menu';
import { type PhonePane, PhoneStack } from '../phone/phone-stack';
import type { SettingsState } from '../settings/settings-state';
import type { Sidebar } from '../sidebar/sidebar';
import { focusList } from './commands';
import { exportMenu } from './menus';
import type { PageParts } from './page-parts';

export interface PhoneViewOf {
  readonly shell: HTMLElement;
  readonly list: HTMLElement;
  readonly menu: MenuBus;
  readonly settings: SettingsState;
  readonly sidebar: Sidebar;
  readonly page: PageView;
  parts(): PageParts;
  /** The pane shown changed, or the window became a phone's or stopped being one. */
  changed(): void;
}

export interface PhoneView {
  readonly stack: PhoneStack;
  /** The system's back: a menu closes, else one pane back; false when there was nothing to do. */
  back(): boolean;
  /** The page's ⋯ menu, under `opener`. */
  more(opener: HTMLElement): void;
}

export function phoneView(of: PhoneViewOf): PhoneView {
  // The keyboard into a pane just shown: on the page, its title (no phone keyboard comes up).
  const focusPane = (pane: PhonePane) =>
    pane === 'sidebar'
      ? of.sidebar.focusTree()
      : pane === 'list'
        ? focusList(of.list)
        : of.page.focus();
  const more = (opener: HTMLElement) => {
    const run = (command: MenuCommand) => of.menu.run(command);
    // The same choices as the note's own menu, each the File menu's command.
    const exportTo = () =>
      openMenu(
        exportMenu(of.parts().exports.kinds, false, (kind) =>
          run(kind === 'html' ? 'export-ao3' : `export-note:${kind}`),
        ),
        { opener },
        'Export',
      );
    const { values } = of.settings;
    const state = { values, sprinting: of.parts().counters.sprinting, exportTo };
    openMenu(moreItems(state, run), { opener }, 'More');
  };
  const stack = new PhoneStack({
    shell: of.shell,
    backName: (to) =>
      to === 'sidebar'
        ? 'Library'
        : (of.list.querySelector('.list__heading')?.textContent ?? 'Notes'),
    focus: (pane: PhonePane) => focusPane(pane),
    changed: of.changed,
    leavingPage: () => {
      const { outline, versions } = of.parts();
      if (outline.open) void outline.toggle();
      if (of.page.comparing) void versions.cycleCompare('draft');
      if (versions.panelOpen) versions.showPanel(false);
    },
    // Turned sideways, the panes all show: a pane shut gives the page the keyboard (spec §4).
    lost: () => (stack.phone ? focusPane(stack.shown ?? 'list') : of.page.focus()),
  });
  of.shell.prepend(stack.bar);
  /** What lies over the page closes before the page is left: Compare, the cards, the versions. */
  const closeOver = (): boolean => {
    if (stack.shown !== 'page') return false;
    const { outline, versions } = of.parts();
    if (outline.open) void outline.toggle();
    else if (of.page.comparing) void versions.cycleCompare('draft');
    else if (versions.panelOpen) versions.showPanel(false);
    else return false;
    return true;
  };
  return {
    stack,
    back: () => closeMenu() || pressEsc() || closeOver() || stack.back(),
    more,
  };
}

/**
 * Back first does what Esc does where the keyboard is: a rename being typed (the title, a
 * folder, a seal's name, a book's goal) stops, keeping nothing. Whether anything took it.
 */
function pressEsc(): boolean {
  const at = document.activeElement;
  if (!at || at === document.body) return false;
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  at.dispatchEvent(event);
  return event.defaultPrevented;
}
