// Exports (spec §8): a note, or a book's chapters in its order, as
// HTML, EPUB, Word or a PDF, made here with core/export and saved where the
// writer chooses (on the phone, in Eien/Exports). The open note goes as it
// is on the page, words not yet saved included.

import {
  docx,
  type ExportNote,
  type ExportRequest,
  epub,
  pageSizeOf,
  printHtml,
} from '../../core/export';
import { toHtml } from '../../core/html';
import { baseName, joinPath, titleOf } from '../../core/paths';
import { isSyncConflictName } from '../../core/vault';
import type { ExportFormat, OutBridge, OutFile, OutKind, VaultBridge } from '../../platform/bridge';
import { reasonOf } from '../reason';
import type { SettingsState } from '../settings/settings-state';
import { currentBook } from './current-book';
import { ExportImages, leftImages } from './export-images';
import type { Navigation } from './navigation';
import type { OpenNote } from './open-note';
import type { VaultState } from './vault-state';

export interface ExportParts {
  readonly state: VaultState;
  readonly nav: Navigation;
  readonly note: OpenNote;
  readonly vault: VaultBridge;
  readonly out: OutBridge;
  readonly settings: SettingsState;
  tell(message: string): void;
}

export interface Exports {
  /** What this device can save: every kind, but a PDF on the phone. */
  readonly kinds: readonly OutKind[];
  /** A note, open or not ('html' is plain HTML). */
  note(path: string, kind: OutKind): Promise<void>;
  /** A book's chapters in its order. */
  book(folder: string, kind: ExportFormat): Promise<void>;
  /** File → Export Note: the open note. */
  openNote(kind: OutKind): Promise<void>;
  /** File → Export Book: the open chapter's book, else the book chosen. */
  currentBook(kind: ExportFormat): Promise<void>;
}

/** Thrown when there's nothing to export; its message is the news. */
class Nothing extends Error {}

export function exportsOf(parts: ExportParts): Exports {
  const { state, note, tell } = parts;
  const quotes = () => parts.settings.values['typography.quotes'];

  /** A note's text: the page's for the open one, else the disk's. */
  async function textOf(path: string): Promise<string> {
    if (note.path === path && note.session) return note.session.text;
    const file = await parts.vault.read(path);
    if (!file) throw new Error(`“${titleOf(baseName(path))}” isn’t there any more.`);
    return file.text;
  }

  /** What's saved for `request`, as `kind`. */
  function fileOf(request: ExportRequest, kind: OutKind): OutFile {
    if (kind === 'epub') return { kind, bytes: epub(request) };
    if (kind === 'docx') return { kind, bytes: docx(request) };
    if (kind === 'pdf')
      return { kind, html: printHtml(request), page: pageSizeOf(request.language) };
    const sceneBreak = parts.settings.values['html.sceneBreak'];
    return {
      kind,
      text: toHtml(request.notes[0]?.markdown ?? '', { quotes: quotes(), sceneBreak }),
    };
  }

  const request = (
    title: string,
    notes: ExportNote[],
    book: boolean,
    key: string,
  ): ExportRequest => ({
    title,
    notes,
    book,
    quotes: quotes(),
    language: navigator.language,
    key: `${state.name}/${key}`,
    date: new Date(),
  });

  /** Save what `make` makes; its images, for a book's formats (plain HTML keeps its addresses). */
  async function save(
    name: string,
    make: (images: ExportImages | null) => Promise<ExportRequest>,
    kind: OutKind,
  ) {
    try {
      const images =
        kind === 'html' ? null : new ExportImages((path) => parts.vault.readBytes(path));
      const made = await make(images);
      if (kind === 'pdf') tell('Making the PDF…');
      const saved = await parts.out.saveAs(name, fileOf(made, kind));
      if (saved) tell(`Saved as “${saved}”.${leftImages(images?.left ?? 0)}`);
    } catch (error) {
      tell(
        error instanceof Nothing ? error.message : `It couldn’t be exported: ${reasonOf(error)}`,
      );
    }
  }

  async function exportNote(path: string, kind: OutKind): Promise<void> {
    const title = titleOf(baseName(path));
    await save(
      title,
      async (images) => {
        const markdown = await textOf(path);
        // No words to show (as Copy as HTML finds them): nothing to export.
        if (!toHtml(markdown, { quotes: 'straight', sceneBreak: 'rule' })) {
          throw new Nothing('Nothing to export: the note has no words yet.');
        }
        const carried = (await images?.of(path, markdown)) ?? new Map();
        return request(title, [{ title, markdown, images: carried }], false, path);
      },
      kind,
    );
  }

  async function exportBook(folder: string, kind: ExportFormat): Promise<void> {
    const title = folder ? baseName(folder) : state.name;
    await save(
      title,
      async (images) => {
        // Syncthing's conflict copies sit beside their chapter: never a chapter themselves.
        const names = (await state.folderOrder(folder)).filter((name) => !isSyncConflictName(name));
        if (!names.length) throw new Nothing('Nothing to export: the book has no chapters yet.');
        const notes: ExportNote[] = [];
        for (const name of names) {
          const path = joinPath(folder, name);
          const markdown = await textOf(path);
          const carried = (await images?.of(path, markdown)) ?? new Map();
          notes.push({ title: titleOf(name), markdown, images: carried });
        }
        return request(title, notes, true, folder);
      },
      kind,
    );
  }

  return {
    kinds: parts.out.kinds,
    note: exportNote,
    book: exportBook,
    async openNote(kind) {
      if (note.path) await exportNote(note.path, kind);
    },
    async currentBook(kind) {
      const folder = await currentBook(state, parts.nav, note.path);
      if (folder === null)
        tell('Export Book exports a book: choose one, or open one of its chapters.');
      else await exportBook(folder, kind);
    },
  };
}
