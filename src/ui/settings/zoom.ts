// ⌘+, ⌘− and ⌘0 (Ctrl elsewhere; spec §4): with the keyboard in the page,
// they zoom the page alone; anywhere else, the whole interface, as a browser
// zooms. ⌘0 puts back whichever ⌘+ would change.

import { numberSetting, stepped } from '../../core/config';
import type { MenuCommand } from '../../platform/bridge';

export type ZoomKey = 'page.zoom' | 'window.zoom';
type ZoomCommand = Extract<MenuCommand, `zoom:${string}`>;

const STEPS: Readonly<Record<ZoomCommand, number>> = {
  'zoom:in': 1,
  'zoom:out': -1,
  'zoom:reset': 0,
};

export const isZoomCommand = (command: MenuCommand): command is ZoomCommand =>
  Object.hasOwn(STEPS, command);

/** Which zoom a key changes: the page's with the keyboard in it, or where the interface has no zoom of its own. */
export const zoomKeyFor = (inPage: boolean, wholeZoom: boolean): ZoomKey =>
  inPage || !wholeZoom ? 'page.zoom' : 'window.zoom';

/** `now`, zoomed by `command`: a step in or out (no further than the setting goes), or back to 100%. */
export function zoomedBy(command: ZoomCommand, key: ZoomKey, now: number): number {
  const setting = numberSetting(key);
  return command === 'zoom:reset' ? setting.default : stepped(setting, now, STEPS[command]);
}

/** Whether the keyboard is in the page: the editor, its sheet, its bar or its colophon. */
export const keyboardInPage = (doc: Document = document): boolean =>
  doc.activeElement?.closest('.page') != null;
