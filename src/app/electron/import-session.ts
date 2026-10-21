// File → Import Markdown Folder… (spec §8): the writer chooses a folder with
// the system's dialog; its notes are copied into the vault
// (platform/electron/import-folder.ts); when anything was left out, a
// dialog lists what and why.

import { type BrowserWindow, dialog } from 'electron';
import { type ImportReport, LEFT_REASONS } from '../../core/import';
import { CHANNEL } from '../../platform/bridge';
import { importFolder } from '../../platform/electron/import-folder';
import { answer } from './ipc';
import type { VaultSession } from './vault-session';

/** How many left-out files the dialog names; the rest it counts. */
const NAMED = 30;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** The dialog's words for what was left out. */
export function leftOutMessage(report: ImportReport): { message: string; detail: string } {
  const named = report.left
    .slice(0, NAMED)
    .map((each) => `${each.path}: ${LEFT_REASONS[each.reason]}`);
  const more = report.left.length - named.length;
  return {
    message: `${plural(report.left.length, 'file')} didn’t come in.`,
    detail: [...named, ...(more > 0 ? [`… and ${plural(more, 'more')}.`] : [])].join('\n'),
  };
}

export function serveImport(window: BrowserWindow, session: VaultSession): void {
  answer(window, CHANNEL.importFolder, async () => {
    const vault = session.vault();
    const root = session.root;
    if (!root) throw new Error('No vault is open.');
    const picked = await dialog.showOpenDialog(window, {
      title: 'Import a folder of Markdown',
      buttonLabel: 'Import',
      properties: ['openDirectory'],
    });
    const source = picked.filePaths[0];
    if (picked.canceled || !source) return null;
    const report = await importFolder(source, root, vault);
    if (report.left.length > 0 && !window.isDestroyed()) {
      await dialog.showMessageBox(window, { type: 'info', ...leftOutMessage(report) });
    }
    return report;
  });
}
