// How the main process answers its windows. Each channel is listened to once,
// for every window; each call goes to the answer of the window that sent it,
// and ends with that window. Each argument is checked by the answer.

import { type BrowserWindow, type IpcMainInvokeEvent, ipcMain } from 'electron';

type Answer = (...args: unknown[]) => unknown;

/** Each window's answers, by its page's id, while the window is open. */
const answers = new Map<number, Map<string, Answer>>();
/** The channels listened to: once each, however many windows there are. */
const listening = new Set<string>();

/** Answer `channel` for `window` alone, until the window closes. */
export function answer(window: BrowserWindow, channel: string, fn: Answer): void {
  const id = window.webContents.id;
  let mine = answers.get(id);
  if (!mine) {
    mine = new Map();
    answers.set(id, mine);
    window.once('closed', () => answers.delete(id));
  }
  if (mine.has(channel)) throw new Error(`This window answers ${channel} already.`);
  mine.set(channel, fn);
  if (listening.has(channel)) return;
  listening.add(channel);
  ipcMain.handle(channel, (event: IpcMainInvokeEvent, ...args: unknown[]) => {
    const theirs = answers.get(event.sender.id)?.get(channel);
    if (!theirs) throw new Error('Not a window Eien knows.');
    return theirs(...args);
  });
}

/** `value`, which must be a list of texts, or nothing (null or undefined, as null). */
export function texts(value: unknown, name: string): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || !value.every((each) => typeof each === 'string'))
    throw new TypeError(`${name} must be a list of texts.`);
  return value;
}

/** `value`, which must be text. */
export function text(value: unknown, name: string): string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be text.`);
  return value;
}
