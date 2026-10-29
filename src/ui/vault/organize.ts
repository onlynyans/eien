// Organizing the vault (spec §2–§4): renaming and moving notes and folders,
// sending them to the trash, a folder's order, books and pins. Each keeps
// the rest in step: the folder's order follows a renamed note, pins follow a
// move, the open note carries on at its new name, and a note's own folder of
// images ("Chapter 3.assets") goes where the note goes, its links following.

import {
  baseName,
  freeName,
  isInside,
  joinPath,
  movedPath,
  parentOf,
  type Renamed,
  renamedPath,
  titleOf,
} from '../../core/paths';
import {
  FOLDER_SETTINGS_NAME,
  type FolderChange,
  movedPins,
  parseFolderSettings,
  placedBefore,
  presentInOrder,
  renamedInOrder,
  withFolderSettings,
  withoutInOrder,
  withoutPins,
  withPin,
} from '../../core/vault';
import type { VaultBridge } from '../../platform/bridge';
import type { NoteSession } from '../notes/note-session';
import { reasonOf } from '../reason';
import { moveAssets, trashAssets } from './note-assets';
import { SmallFiles } from './small-files';
import type { VaultState } from './vault-state';

export interface OrganizeContext {
  readonly vault: VaultBridge;
  readonly state: VaultState;
  /** "the trash", or on Windows "the Recycle Bin". */
  readonly trashName: string;
  /** The notes open now, on whichever pages. */
  sessions(): readonly NoteSession[];
  /** `path` was sent to the trash: the pages showing it, or a note in it, show nothing. */
  closed(path: string): void;
  /** Hold the pages showing `path`, or a note in it, still while it's moved or trashed (true), or let them go. */
  freeze?(path: string, frozen: boolean): void;
  /** A quiet line in the list: what happened, or why it couldn't. */
  tell(message: string): void;
  /**
   * Change the words of the note at `path`, if it's the one open, as an edit
   * of Eien's own (the caret and the undo history stay), and save it: whether
   * that worked, or null when the note isn't open.
   */
  amendOpen?(path: string, change: (text: string) => string): Promise<boolean | null>;
  /** `from` was moved to `to`: the pages showing what was there (an EPUB's, #40) follow it. */
  moved?(from: string, to: string): void;
}

const PROBLEMS: Record<Exclude<Renamed, { ok: true }>['problem'], string> = {
  empty: 'A name needs a letter or a number.',
  taken: 'Something here already has that name.',
};

const nameOf = (path: string) => titleOf(baseName(path)) || path;

export class Organizer {
  readonly #ctx: OrganizeContext;

  /** The vault's own small files: pins, tags, All Notes' order, a folder's settings. */
  readonly #files: SmallFiles;

  constructor(context: OrganizeContext) {
    this.#ctx = context;
    this.#files = new SmallFiles(context);
  }

  /** Rename the note at `path` from the title typed; its new path, or null (and the writer told why). */
  renameNote(path: string, typed: string): Promise<string | null> {
    const renamed = renamedPath(path, typed, this.#ctx.state.namesIn(parentOf(path)), true);
    if (!renamed.ok) return this.#refuse(PROBLEMS[renamed.problem]);
    return this.#move(path, renamed.path, true);
  }

  renameFolder(path: string, typed: string): Promise<string | null> {
    const renamed = renamedPath(path, typed, this.#ctx.state.namesIn(parentOf(path)), false);
    if (!renamed.ok) return this.#refuse(PROBLEMS[renamed.problem]);
    return this.#move(path, renamed.path);
  }

  /** Move a note or folder into `folder` ("" for the vault itself), under a free name there. */
  moveInto(path: string, folder: string, isNote: boolean): Promise<string | null> {
    if (parentOf(path) === folder) return Promise.resolve(path);
    if (!isNote && isInside(folder, path)) {
      return this.#refuse('A folder can’t go inside itself.');
    }
    return this.#move(
      path,
      movedPath(path, folder, this.#ctx.state.namesIn(folder), isNote),
      isNote,
    );
  }

  /** A new folder in `parent`, "New folder" or the first free name like it. */
  async newFolder(parent: string): Promise<string | null> {
    const path = joinPath(parent, freeName('New folder', this.#ctx.state.namesIn(parent)));
    try {
      await this.#ctx.vault.makeFolder(path);
      return path;
    } catch (error) {
      return this.#refuse(`The folder couldn’t be made: ${reasonOf(error)}`);
    }
  }

  /**
   * Send a note or folder to the system's trash, where the writer can take
   * it back. If the trash fails, nothing is deleted, and the writer is told.
   */
  async trash(path: string): Promise<boolean> {
    const held = await this.#hold(path, `go to ${this.#ctx.trashName}`); // its last words go with it
    if (held === 'refused') return false;
    try {
      await this.#ctx.vault.trash(path);
    } catch (error) {
      this.#ctx.tell(
        `“${nameOf(path)}” couldn’t go to ${this.#ctx.trashName}, so nothing was deleted: ${reasonOf(error)}`,
      );
      return false;
    } finally {
      if (held === 'held') this.#ctx.freeze?.(path, false);
    }
    if (held === 'held') this.#ctx.closed(path);
    await this.#files.followPaths((paths) => withoutPins(paths, path));
    await this.#changeOrder(parentOf(path), (order) => withoutInOrder(order, baseName(path)), {
      left: baseName(path),
    });
    this.#ctx.tell(await trashAssets(this.#ctx, path));
    return true;
  }

  /** Make `folder` a book, or not (spec §2: ordered reading, numbered chapters). */
  setBook(folder: string, book: boolean): Promise<boolean> {
    return this.#changeFolder(folder, { book: book ? {} : null });
  }

  /**
   * A book's word goal; null takes it away. A folder gone meanwhile (moved
   * on another device) or no longer a book is left as it is: never made again.
   */
  setGoal(folder: string, goal: number | null): Promise<boolean> {
    return this.#files.update(
      joinPath(folder, FOLDER_SETTINGS_NAME),
      (text) =>
        text === null || parseFolderSettings(text).book === null
          ? undefined
          : withFolderSettings(text, { goal }),
      folder,
    );
  }

  /** Place the note at `path` just before `before` (last, for null) in its folder's own order. */
  async placeBefore(path: string, before: string | null): Promise<boolean> {
    const folder = parentOf(path);
    const shown = await this.#ctx.state.folderOrder(folder);
    const order = placedBefore(shown, baseName(path), before === null ? null : baseName(before));
    // Where it already is: nothing written (a book sorted by name stays so).
    if (order.join('\n') === shown.join('\n')) return true;
    return this.setOrder(folder, { notes: order });
  }

  /**
   * Write a folder's own order: its folders, then its notes, each as given or
   * else as shown now, so a change to one keeps the other (backlog #12).
   */
  async setOrder(
    folder: string,
    { folders, notes }: { folders?: readonly string[]; notes?: readonly string[] },
  ): Promise<boolean> {
    const order = [
      ...(folders ?? this.#ctx.state.folderNames(folder)),
      ...(notes ?? (await this.#ctx.state.folderOrder(folder))),
    ];
    return this.#changeFolder(folder, { order });
  }

  /** One place up or down in its folder's own order. */
  async nudge(path: string, by: -1 | 1): Promise<boolean> {
    const folder = parentOf(path);
    const shown = await this.#ctx.state.folderOrder(folder);
    const at = shown.indexOf(baseName(path));
    const to = at + by;
    if (at < 0 || to < 0 || to >= shown.length) return false;
    const order = [...shown];
    [order[at], order[to]] = [order[to] as string, order[at] as string];
    return this.setOrder(folder, { notes: order });
  }

  pin(path: string, pinned: boolean): Promise<boolean> {
    return this.#files.changePins((pins) => withPin(pins, path, pinned));
  }

  /**
   * If notes open are `path` or in it: hold their pages still and save them,
   * so their last words go where they go. 'refused' when one couldn't be
   * saved — then nothing happens, and the writer is told; the words stay on the page.
   */
  async #hold(path: string, doing: string): Promise<'held' | 'refused' | 'none'> {
    const open = this.#openIn(path);
    if (open.length === 0) return 'none';
    this.#ctx.freeze?.(path, true);
    await Promise.all(open.map((session) => session.flush()));
    const unsaved = open.find((session) => session.state !== 'saved');
    if (!unsaved) return 'held';
    this.#ctx.freeze?.(path, false);
    this.#ctx.tell(
      `“${nameOf(unsaved.path)}” has words that couldn’t be saved yet, so it didn’t ${doing}. They’re still on the page.`,
    );
    return 'refused';
  }

  /** The notes open at `path`, or in it. */
  #openIn(path: string): NoteSession[] {
    return this.#ctx.sessions().filter((session) => isInside(session.path, path));
  }

  /** Move or rename `from` to `to`, keeping order, pins and the open note (and a note's images) in step. */
  async #move(from: string, to: string, isNote = false): Promise<string | null> {
    if (from === to) return to;
    const open = this.#openIn(from);
    const held = await this.#hold(from, 'move'); // nothing half-saved at the old name
    if (held === 'refused') return null;
    let result: Awaited<ReturnType<VaultBridge['move']>>;
    try {
      result = await this.#ctx.vault.move(from, to);
    } catch (error) {
      return this.#refuse(`“${nameOf(from)}” couldn’t be moved: ${reasonOf(error)}`);
    } finally {
      if (held === 'held') this.#ctx.freeze?.(from, false);
    }
    if (!result.ok) {
      const why = {
        missing: 'it isn’t there any more.',
        taken: 'something there has that name.',
        'into-itself': 'a folder can’t go inside itself.',
      };
      return this.#refuse(`“${nameOf(from)}” couldn’t be moved: ${why[result.reason]}`);
    }
    for (const session of open) session.movedTo(to + session.path.slice(from.length));
    this.#ctx.moved?.(from, to);
    await this.#files.followPaths((paths) => movedPins(paths, from, to));
    const [left, came] = [baseName(from), baseName(to)];
    if (parentOf(from) === parentOf(to)) {
      await this.#changeOrder(parentOf(from), (order) => renamedInOrder(order, left, came), {
        left,
        came,
      });
    } else {
      await this.#changeOrder(parentOf(from), (order) => withoutInOrder(order, left), { left });
      // A folder in its own order keeps it: the newcomer goes last.
      await this.#changeOrder(parentOf(to), (order) => [...order, came], { came });
    }
    if (isNote) await moveAssets(this.#ctx, from, to);
    return to;
  }

  /**
   * Change a folder's order, if it has one: a folder in no order isn't given a
   * settings file. `left` and `came` are the names a move just took out of the
   * folder and brought into it: the vault's list may or may not show the move
   * yet (the watcher's refresh can land in between), and the order comes out
   * the same either way.
   */
  async #changeOrder(
    folder: string,
    change: (order: string[]) => string[],
    { left, came }: { left?: string; came?: string } = {},
  ): Promise<void> {
    const { order } = await this.#ctx.state.folderSettings(folder);
    if (order.length === 0) return;
    const others = this.#ctx.state.namesIn(folder).filter((name) => name !== left && name !== came);
    const before = left === undefined ? others : [...others, left];
    const after = came === undefined ? others : [...others, came];
    // Names that aren't there go (spec §2), and listed ones are spelled as the files are.
    const next = presentInOrder(change(presentInOrder(order, before)), after);
    if (next.join('\n') !== order.join('\n')) await this.#changeFolder(folder, { order: next });
  }

  #changeFolder(folder: string, change: FolderChange): Promise<boolean> {
    return this.#files.update(
      joinPath(folder, FOLDER_SETTINGS_NAME),
      (text) => withFolderSettings(text, change),
      folder,
    );
  }

  /** Make a tag no note carries yet (the sidebar's +), or take one made back out. */
  makeTag(tag: string, made: boolean): Promise<boolean> {
    return this.#files.makeTag(tag, made);
  }

  /** The tags in your order (their keys, every level). */
  setTagOrder(order: readonly string[]): Promise<boolean> {
    return this.#files.setTagOrder(order);
  }

  /** All Notes in your order: every note's path, as shown. */
  setAllOrder(paths: readonly string[]): Promise<boolean> {
    return this.#files.setAllOrder(paths);
  }

  async #refuse(message: string): Promise<null> {
    this.#ctx.tell(message);
    return null;
  }
}
