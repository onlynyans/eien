// Organizing the vault (spec §2–§4): renaming and moving notes and folders,
// sending them to the trash, a folder's order, books and pins. Each keeps
// the rest in step: the folder's order follows a renamed note, pins follow a
// move, and the open note carries on at its new name.

import {
  baseName,
  freeName,
  joinPath,
  movedPath,
  parentOf,
  type Renamed,
  renamedPath,
  titleOf,
  VAULT_PINS,
  VAULT_TAGS,
} from '../../core/paths';
import { withMadeTag, withTagOrder } from '../../core/tags';
import {
  FOLDER_SETTINGS_NAME,
  type FolderChange,
  movedPins,
  parseFolderSettings,
  parsePins,
  pinsText,
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
import type { VaultState } from './vault-state';

export interface OrganizeContext {
  readonly vault: VaultBridge;
  readonly state: VaultState;
  /** "the trash", or on Windows "the Recycle Bin". */
  readonly trashName: string;
  /** The note open now, if any. */
  session(): NoteSession | null;
  /** The open note was sent to the trash: show nothing. */
  closed(): void;
  /** Hold the page still while its note is moved or trashed (true), or let it go (false). */
  freeze?(frozen: boolean): void;
  /** A quiet line in the list: what happened, or why it couldn't. */
  tell(message: string): void;
}

/** How many times a small file is read and written again while it keeps changing. */
const TRIES = 3;

const PROBLEMS: Record<Exclude<Renamed, { ok: true }>['problem'], string> = {
  empty: 'A name needs a letter or a number.',
  taken: 'Something here already has that name.',
};

/** What a small file holds, as the writer reads it when it can't be changed. */
const WHAT: Record<string, string> = { pins: 'pins', tags: 'tags made' };

const nameOf = (path: string) => titleOf(baseName(path)) || path;

export class Organizer {
  readonly #ctx: OrganizeContext;

  constructor(context: OrganizeContext) {
    this.#ctx = context;
  }

  /** Rename the note at `path` from the title typed; its new path, or null (and the writer told why). */
  renameNote(path: string, typed: string): Promise<string | null> {
    const renamed = renamedPath(path, typed, this.#ctx.state.namesIn(parentOf(path)), true);
    if (!renamed.ok) return this.#refuse(PROBLEMS[renamed.problem]);
    return this.#move(path, renamed.path);
  }

  renameFolder(path: string, typed: string): Promise<string | null> {
    const renamed = renamedPath(path, typed, this.#ctx.state.namesIn(parentOf(path)), false);
    if (!renamed.ok) return this.#refuse(PROBLEMS[renamed.problem]);
    return this.#move(path, renamed.path);
  }

  /** Move a note or folder into `folder` ("" for the vault itself), under a free name there. */
  moveInto(path: string, folder: string, isNote: boolean): Promise<string | null> {
    if (parentOf(path) === folder) return Promise.resolve(path);
    if (!isNote && (folder === path || folder.startsWith(`${path}/`))) {
      return this.#refuse('A folder can’t go inside itself.');
    }
    return this.#move(path, movedPath(path, folder, this.#ctx.state.namesIn(folder), isNote));
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
      if (held === 'held') this.#ctx.freeze?.(false);
    }
    if (held === 'held') this.#ctx.closed();
    await this.#changePins((pins) => withoutPins(pins, path));
    await this.#changeOrder(parentOf(path), (order) => withoutInOrder(order, baseName(path)), {
      left: baseName(path),
    });
    this.#ctx.tell(`“${nameOf(path)}” is in ${this.#ctx.trashName}.`);
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
    return this.#update(
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
    return this.#changePins((pins) => withPin(pins, path, pinned));
  }

  /**
   * If the open note is `path` or in it: hold the page still and save it, so
   * its last words go where it goes. 'refused' when they couldn't be saved —
   * then nothing happens, and the writer is told; the words stay on the page.
   */
  async #hold(path: string, doing: string): Promise<'held' | 'refused' | 'none'> {
    const open = this.#ctx.session();
    if (!open || (open.path !== path && !open.path.startsWith(`${path}/`))) return 'none';
    this.#ctx.freeze?.(true);
    await open.flush();
    if (open.state === 'saved') return 'held';
    this.#ctx.freeze?.(false);
    this.#ctx.tell(
      `“${nameOf(open.path)}” has words that couldn’t be saved yet, so it didn’t ${doing}. They’re still on the page.`,
    );
    return 'refused';
  }

  /** Move or rename `from` to `to`, keeping order, pins and the open note in step. */
  async #move(from: string, to: string): Promise<string | null> {
    if (from === to) return to;
    const open = this.#ctx.session();
    const inside = (path: string) => path === from || path.startsWith(`${from}/`);
    const held = await this.#hold(from, 'move'); // nothing half-saved at the old name
    if (held === 'refused') return null;
    let result: Awaited<ReturnType<VaultBridge['move']>>;
    try {
      result = await this.#ctx.vault.move(from, to);
    } catch (error) {
      return this.#refuse(`“${nameOf(from)}” couldn’t be moved: ${reasonOf(error)}`);
    } finally {
      if (held === 'held') this.#ctx.freeze?.(false);
    }
    if (!result.ok) {
      const why = {
        missing: 'it isn’t there any more.',
        taken: 'something there has that name.',
        'into-itself': 'a folder can’t go inside itself.',
      };
      return this.#refuse(`“${nameOf(from)}” couldn’t be moved: ${why[result.reason]}`);
    }
    if (open && inside(open.path)) open.movedTo(to + open.path.slice(from.length));
    await this.#changePins((pins) => movedPins(pins, from, to));
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
    return this.#update(
      joinPath(folder, FOLDER_SETTINGS_NAME),
      (text) => withFolderSettings(text, change),
      folder,
    );
  }

  /**
   * Make a tag no note carries yet (the sidebar's +), or take one made back out:
   * kept in .eien/tags.json. Whether it was written.
   */
  makeTag(tag: string, made: boolean): Promise<boolean> {
    return this.#update(VAULT_TAGS, (text) => withMadeTag(text, tag, made), 'tags');
  }

  /** The tags in your order (their keys, every level), kept in .eien/tags.json. */
  setTagOrder(order: readonly string[]): Promise<boolean> {
    return this.#update(VAULT_TAGS, (text) => withTagOrder(text, order), 'tags');
  }

  #changePins(change: (pins: string[]) => string[]): Promise<boolean> {
    return this.#update(
      VAULT_PINS,
      (text) => {
        const pins = parsePins(text);
        const next = change(pins);
        // No file is written for no change: a vault never pinned has no pins file.
        return next.join('\n') === pins.join('\n') ? undefined : pinsText(next);
      },
      'pins',
    );
  }

  /**
   * Read a small file, change it, and write it back at the version read; read
   * again if it changed meanwhile. `change` gives the new text, undefined for
   * nothing to write, or null when the file can't be read as it should be.
   */
  async #update(
    path: string,
    change: (text: string | null) => string | null | undefined,
    what: string,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const file = await this.#ctx.vault.read(path);
      const next = change(file?.text ?? null);
      if (next === undefined) return true;
      if (next === null) {
        this.#ctx.tell(
          `${path} isn’t valid JSON, so the ${WHAT[what] ?? 'folder’s settings'} weren’t changed. Fix or remove it, then try again.`,
        );
        return false;
      }
      if ((await this.#ctx.vault.write(path, next, file?.version ?? null)).ok) return true;
    }
    this.#ctx.tell(`${path} kept changing; try again.`);
    return false;
  }

  async #refuse(message: string): Promise<null> {
    this.#ctx.tell(message);
    return null;
  }
}
