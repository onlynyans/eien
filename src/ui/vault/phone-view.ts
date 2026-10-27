// The vault on a phone (spec §10): one pane at a time (../phone/phone-stack.ts), or wider, as
// the Wide screen setting's room says (../phone/room.ts),
// back to the one before, and the page's ⋯ (the `more` command the layout
// draws, ../chrome) for what the menu bar offers on the desktop. Choosing a folder or tag shows its notes; opening a note
// shows the page, with the keyboard on its title, so reading a note doesn't
// bring up the phone's keyboard.

import type { MenuCommand } from '../../platform/bridge';
import { focusList } from '../list/list';
import { closeMenu, openMenu } from '../menu/menu';
import type { MenuBus } from '../menu/menu-bus';
import { moreItems } from '../phone/more-menu';
import { PhoneStack } from '../phone/phone-stack';
import { closesBeside, type PhonePane, roomOf } from '../phone/room';
import type { SettingsState } from '../settings/settings-state';
import type { Sidebar } from '../sidebar/sidebar';
import { exportMenu } from './menu-items';
import type { PageParts } from './page-parts';
import type { Pages } from './pages';
import { phoneOther } from './phone-other';

export interface PhoneViewOf {
  readonly shell: HTMLElement;
  /** The system's name (process.platform's, or the phone's): Wide screen is the phone's alone. */
  readonly platform: string;
  readonly list: HTMLElement;
  readonly menu: MenuBus;
  readonly settings: SettingsState;
  readonly sidebar: Sidebar;
  readonly pages: Pages;
  /** Whether a note is still in the vault (the other note, to go back to). */
  has(path: string): boolean;
  parts(): PageParts;
  /** The pane shown changed, or the window became a phone's or stopped being one. */
  changed(): void;
}

export interface PhoneView {
  readonly stack: PhoneStack;
  /** The window drawn: the back word named anew, and the other note's slip as it is now. */
  drawn(): void;
  /** The system's back: a menu closes, else one pane back; false when there was nothing to do. */
  back(): boolean;
  /** The page's ⋯ menu, under `opener`. */
  more(opener: HTMLElement): void;
  stop(): void;
}

export function phoneView(of: PhoneViewOf): PhoneView {
  // The keyboard into a pane just shown: on the page, its title (no phone keyboard comes up).
  const focusPane = (pane: PhonePane) =>
    pane === 'sidebar'
      ? of.sidebar.focusTree()
      : pane === 'list'
        ? focusList(of.list)
        : of.pages.active.page.focus();
  const more = (opener: HTMLElement) => {
    const run = (command: MenuCommand) => of.menu.run(command);
    // The same choices as the note's own menu, each the File menu's command.
    const exportTo = () =>
      openMenu(
        exportMenu(of.parts().exports.kinds, false, (kind) =>
          run(kind === 'html' ? 'export-html' : `export-note:${kind}`),
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
    room: (width) => roomOf(width, of.platform, of.settings.values),
    backName: (to) =>
      to === 'sidebar'
        ? 'Library'
        : (of.list.querySelector('.list__heading')?.textContent ?? 'Notes'),
    focus: (pane: PhonePane) => focusPane(pane),
    changed: () => {
      // A room with no second page (folded, or Wide screen set): the page you're not in closes,
      // its note and place kept as the other note, a tap away.
      const beside = of.pages.other;
      if (beside && closesBeside(stack.room, of.platform)) {
        other.sync();
        of.pages.close(beside);
      }
      of.changed();
    },
    leavingPage: () => {
      const { outline } = of.parts();
      const { page, versions } = of.pages.active;
      if (outline.open) void outline.toggle();
      if (page.comparing) void versions.cycleCompare('draft');
      if (versions.panelOpen) versions.showPanel(false);
    },
    // Turned sideways, the panes all show: a pane shut gives the page the keyboard (spec §4).
    lost: () => (stack.phone ? focusPane(stack.shown ?? 'list') : of.pages.active.page.focus()),
  });
  of.shell.prepend(stack.bar);
  const stopRoom = of.settings.onChange(() => stack.roomChanged());
  // Two pages: the notes slide over the page, which is inert under them (../phone/phone-stack.ts),
  // and a tap anywhere but on them, or the bar, puts them away.
  const putAway = (event: PointerEvent) => {
    const on = event.target instanceof Element ? event.target : null;
    if (on?.closest('.shell > .sidebar, .shell > .list, .phone-bar') || !putAwayNotes()) return;
    event.preventDefault();
    event.stopPropagation();
  };
  of.shell.addEventListener('pointerdown', putAway, true);
  // The note you came from, a tap away at the bar's right (./phone-other.ts): where two pages
  // may open, it opens beside this one.
  const other = phoneOther({
    pages: of.pages,
    has: of.has,
    onPage: () => stack.phone && stack.shown === 'page' && !of.pages.split,
    // Where it was left, then the window drawn (the panes laid out, which draws them).
    open: (place) => of.pages.open(place.path, stack.splits, place).then(of.changed),
  });
  stack.bar.append(other.element);
  /** What lies over the page closes before the page is left: Compare, the cards, the versions. */
  const closeOver = (): boolean => {
    if (stack.shown !== 'page') return false;
    const { outline } = of.parts();
    const { page, versions } = of.pages.active;
    if (outline.open) void outline.toggle();
    else if (page.comparing) void versions.cycleCompare('draft');
    else if (versions.panelOpen) versions.showPanel(false);
    else return false;
    return true;
  };
  const putAwayNotes = (): boolean => {
    if (stack.room !== 'pages' || stack.shown === 'page') return false;
    stack.show('page');
    return true;
  };
  return {
    stack,
    drawn() {
      stack.rename();
      other.sync();
    },
    // With two pages, the notes over the page go first: back puts them away, the page still there.
    back: () => closeMenu() || pressEsc() || closeOver() || putAwayNotes() || stack.back(),
    more,
    stop() {
      stopRoom();
      of.shell.removeEventListener('pointerdown', putAway, true);
      stack.stop();
    },
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
