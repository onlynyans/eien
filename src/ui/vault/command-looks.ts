// How each of the layout's commands looks now, for a shown vault
// (./chrome-wiring.ts draws them): a view chosen, Focus on, the list shut,
// Compare showing the changes. A command for one kind of page
// (../chrome/commands.ts, `on`) is set aside while the page it acts on is
// another kind (#40): a book never takes Bold, so a greyed Bold would say
// something false. The window's look the same whatever the page holds.

import { type FormatCommandId, headingLevel } from '../../core/format';
import type { Layout } from '../chrome/commands';
import { actsOn, type CommandId, commandOf } from '../chrome/commands';
import type { CommandLook } from '../chrome/host';
import { isEpub } from '../epub/epub-side-types';
import type { SettingsState } from '../settings/settings-state';
import type { PaneLayout } from '../shell/panes';
import { COMPARE_WORD } from '../versions/seal-line';
import { isNote, type NoteSide, type Side } from './pages';

export interface LooksOf {
  readonly panes: PaneLayout;
  readonly settings: SettingsState;
  /** The layout drawn now, if any. */
  layout(): Layout | null;
  /** Whether the page's controls are put away to a strip. */
  strip(): boolean;
  /** Whether the quick look (#49) is open. */
  lookOpen(): boolean;
}

const NAMES = { live: 'Live', source: 'Source', reading: 'Reading' } as const;
const night = matchMedia('(prefers-color-scheme: dark)');

/** Whether the window is by night: chosen so, or the system's while System is. */
export const isNight = (settings: SettingsState): boolean => {
  const scheme = settings.values['appearance.scheme'];
  return scheme === 'night' || (scheme === 'system' && night.matches);
};

/** How `id` looks now, for `side`, the page it acts on. */
export function commandLooks(of: LooksOf): (id: CommandId, side: Side) => CommandLook {
  const { panes, settings } = of;
  const two = () => settings.values['layout.panes'] === 'two';
  const barShown = () => settings.values['editor.formatBar'] === 'on';

  /** What's on at the caret, read once for all the bar's buttons (the editor's state the key). */
  let formatsFor: { state: unknown; on: ReadonlySet<FormatCommandId> } | null = null;
  const formatsOn = ({ editor }: NoteSide['page']) => {
    const state = editor.view.state;
    if (formatsFor?.state !== state) formatsFor = { state, on: editor.formats };
    return formatsFor.on;
  };
  /** A formatting command's look: pressed where its format is on, off where there's nothing to format. */
  const formatLook = (id: CommandId, page: NoteSide['page']): CommandLook => {
    const { writable, mode, editor } = page;
    if (!writable || mode === 'reading') return { disabled: true, pressed: false };
    if (id === 'format.heading') return { pressed: headingLevel(editor.caretLine) > 0 };
    // In a table, the caret's menus; elsewhere it puts a table in.
    if (id === 'format.table') {
      const inTable = editor.inTable;
      return {
        pressed: inTable,
        tip: inTable ? 'Table: this row’s and column’s menus' : undefined,
      };
    }
    const sends = commandOf(id).sends ?? '';
    return { pressed: formatsOn(page).has(sends.slice('format:'.length) as FormatCommandId) };
  };

  /** A note's commands, for its page. */
  const noteLook = (id: CommandId, { versions, page }: NoteSide): CommandLook => {
    const { mode } = page;
    switch (id) {
      case 'view.live':
      case 'view.source':
      case 'view.reading':
        return { pressed: mode === id.slice('view.'.length) };
      case 'view.next':
        return { icon: mode, tip: `${NAMES[mode]} · next view` };
      case 'compare': {
        const word = COMPARE_WORD[versions.compareMode];
        if (!versions.canCompare)
          return { disabled: true, pressed: false, tip: 'No versions to compare yet' };
        return { pressed: word !== '', tip: word ? `Compare · ${word}` : undefined };
      }
      case 'versions':
        return { pressed: versions.panelOpen };
      case 'focus':
        return { pressed: settings.values['editor.focus'] === 'on' };
      default:
        return id.startsWith('format.') ? formatLook(id, page) : {};
    }
  };

  /** A book's commands: the shelf's view pressed; the bookmark pressed on a bookmarked page. */
  const bookLook = (id: CommandId, side: Side): CommandLook => {
    if (id === 'view.pages' || id === 'view.scroll')
      return { pressed: settings.values['epub.view'] === id.slice('view.'.length) };
    // On the edge, the strip down the page is the marks, in sight; the list has no lens for them.
    if (id === 'marks') return settings.values['epub.marks'] === 'edge' ? { aside: true } : {};
    if (id === 'bookmark') {
      const on = isEpub(side) && side.marks.bookmarks.on;
      return { pressed: on, tip: on ? 'Take the bookmark off' : undefined };
    }
    return {};
  };

  /** The window's commands, the same whatever the page holds. */
  const windowLook = (id: CommandId): CommandLook | null => {
    switch (id) {
      case 'pane.sidebar': {
        const shut = panes.isShut('sidebar');
        return { pressed: !shut, tip: shut ? 'Show the sidebar' : 'Hide the sidebar' };
      }
      case 'pane.list': {
        // No room for the list beside the page: stepped aside or not, it can't come back here.
        if (panes.crowded)
          return {
            disabled: true,
            tip: 'No room for three panes here: the sidebar lists the notes',
          };
        if (panes.aside) return { pressed: false, tip: 'Show the note list' };
        const shut = panes.isShut('list');
        if (panes.two)
          return { disabled: true, tip: 'Off with two panes: the sidebar lists the notes' };
        return { pressed: !shut, tip: shut ? 'Show the note list' : 'Hide the note list' };
      }
      case 'format-bar':
        return {
          pressed: barShown(),
          tip: barShown() ? 'Hide the formatting bar' : 'Show the formatting bar',
        };
      case 'strip': {
        const slip = of.layout() === 'slip';
        const strip = of.strip();
        return {
          icon: slip ? (strip ? 'left' : 'right') : strip ? 'down' : 'up',
          tip: strip ? 'Show the controls' : 'Hide the controls',
          pressed: undefined,
        };
      }
      case 'scheme': {
        const dark = isNight(settings);
        return {
          icon: dark ? 'moon' : 'sun',
          pressed: dark,
          tip: dark ? 'Night · switch to day' : 'Day · switch to night',
        };
      }
      case 'look':
        return { expanded: of.lookOpen() };
      case 'panes':
        // Three chosen, two shown for the room (#68): the choice is still Three, to switch from.
        if (panes.crowded)
          return {
            icon: 'panes3',
            pressed: false,
            tip: 'Three panes, two here for the room · switch to two',
          };
        return {
          icon: two() ? 'panes2' : 'panes3',
          pressed: two(),
          tip: two() ? 'Two panes · switch to three' : 'Three panes · switch to two',
        };
      default:
        return null;
    }
  };

  return (id, side) => {
    // A command for another kind of page than the one it would act on: there, it does nothing.
    if (!actsOn(id, side.kind)) return { aside: true };
    return windowLook(id) ?? (isNote(side) ? noteLook(id, side) : bookLook(id, side));
  };
}
