// The vault on a phone (spec §10): one pane at a time (../phone/phone-stack.ts),
// back to the one before, and the page's ⋯ for what the menu bar offers on
// the desktop. Choosing a folder or tag shows its notes; opening a note
// shows the page, with the keyboard on its title, so reading a note doesn't
// bring up the phone's keyboard.

import { closeMenu, openMenu } from '../menu/menu';
import type { MenuBus } from '../menu/menu-bus';
import type { PageView } from '../page/page';
import { moreItems } from '../phone/more-menu';
import { type PhonePane, PhoneStack } from '../phone/phone-stack';
import type { SettingsState } from '../settings/settings-state';
import type { Sidebar } from '../sidebar/sidebar';
import { focusList } from './commands';
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
}

export function phoneView(of: PhoneViewOf): PhoneView {
  const stack = new PhoneStack({
    shell: of.shell,
    backName: (to) =>
      to === 'sidebar'
        ? 'Library'
        : (of.list.querySelector('.list__heading')?.textContent ?? 'Notes'),
    more: (opener) =>
      openMenu(
        moreItems(
          { values: of.settings.values, sprinting: of.parts().counters.sprinting },
          (command) => of.menu.run(command),
        ),
        { opener },
        'More',
      ),
    // The keyboard into the pane just shown: on the page, its title (no keyboard comes up).
    focus: (pane: PhonePane) =>
      pane === 'sidebar'
        ? of.sidebar.focusTree()
        : pane === 'list'
          ? focusList(of.list)
          : of.page.focus(),
    changed: of.changed,
  });
  of.shell.prepend(stack.bar);
  /** What lies over the page closes before the page is left: the outline cards, the versions. */
  const closeOver = (): boolean => {
    const { outline, versions } = of.parts();
    if (outline.open) void outline.toggle();
    else if (versions.panelOpen) versions.showPanel(false);
    else return false;
    return true;
  };
  return { stack, back: () => closeMenu() || closeOver() || stack.back() };
}
