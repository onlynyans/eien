// One open note: what's on screen, what's on disk, and keeping them in step
// (spec §3). Autosave after a pause; never a write over a version we didn't
// read; if the file and the editor both changed, the writer's text moves to a
// sibling copy and the file keeps the other. Words are never lost.

import { baseName, conflictName, parentOf, titleOf } from '../../core/paths';
import { diskChange } from '../../core/saving';
import { formatOf, fromEditor, type TextFormat, toEditor } from '../../core/text';
import type { VaultBridge } from '../../platform/bridge';

/** Typing stops this long before a save. */
export const SAVE_AFTER_MS = 800;

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed';

export type NoteVault = Pick<VaultBridge, 'read' | 'write' | 'list'>;

export interface NoteEvents {
  /** The save state changed. */
  status(state: SaveState): void;
  /** The file changed elsewhere and there were no edits here: show `text`. */
  replaced(text: string): void;
  /** Both changed: the writer's text now lives at `path` (a sibling copy). */
  movedToCopy(path: string, from: string): void;
  /** The file was deleted elsewhere, with nothing unsaved here. */
  gone(): void;
}

export class NoteSession {
  #path: string;
  #format: TextFormat;
  /** What the file held when last read or written, as editor text. */
  #base: string;
  #version: string;
  #text: string;
  #state: SaveState = 'saved';
  #timer: ReturnType<typeof setTimeout> | undefined;
  /** Saves and disk checks run one at a time, in order. */
  #queue: Promise<void> = Promise.resolve();
  readonly #vault: NoteVault;
  readonly #events: NoteEvents;
  readonly #now: () => Date;

  private constructor(
    vault: NoteVault,
    path: string,
    raw: string,
    version: string,
    events: NoteEvents,
    now: () => Date,
  ) {
    this.#vault = vault;
    this.#events = events;
    this.#now = now;
    this.#path = path;
    this.#format = formatOf(raw);
    this.#base = this.#text = toEditor(raw);
    this.#version = version;
  }

  /** The note at `path`, or null if there's none. */
  static async open(
    vault: NoteVault,
    path: string,
    events: NoteEvents,
    now: () => Date = () => new Date(),
  ): Promise<NoteSession | null> {
    const file = await vault.read(path);
    return file ? new NoteSession(vault, path, file.text, file.version, events, now) : null;
  }

  get path(): string {
    return this.#path;
  }
  get text(): string {
    return this.#text;
  }
  get state(): SaveState {
    return this.#state;
  }

  /** The writer typed: keep the text, and save once typing pauses. */
  edit(text: string): void {
    this.#text = text;
    if (text === this.#base) {
      this.#setState('saved');
      return;
    }
    this.#setState('unsaved');
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#enqueue(() => this.#save()), SAVE_AFTER_MS);
  }

  /** Save now if anything is unsaved, and wait for every save under way. */
  flush(): Promise<void> {
    clearTimeout(this.#timer);
    return this.#enqueue(() => this.#save());
  }

  /** The file may have changed on disk: look, and act (spec §3). */
  diskChanged(): Promise<void> {
    return this.#enqueue(() => this.#checkDisk());
  }

  #enqueue(task: () => Promise<void>): Promise<void> {
    this.#queue = this.#queue.then(task, task);
    return this.#queue;
  }

  async #save(): Promise<void> {
    const text = this.#text;
    if (text === this.#base) return this.#setState('saved');
    this.#setState('saving');
    try {
      const raw = fromEditor(text, this.#format);
      const result = await this.#vault.write(this.#path, raw, this.#version);
      if (result.ok) {
        this.#base = text;
        this.#version = result.version;
      } else if (result.current === null) {
        // Deleted elsewhere while there were edits here: put the note back.
        const again = await this.#vault.write(this.#path, raw, null);
        if (!again.ok) return this.#retryLater();
        this.#base = text;
        this.#version = again.version;
      } else {
        await this.#resolve(text, result.current.text, result.current.version);
      }
      this.#setState(this.#text === this.#base ? 'saved' : 'unsaved');
      if (this.#state === 'unsaved') this.edit(this.#text); // typed during the save
    } catch (error) {
      // The words stay on screen and the save is retried; the cause goes to the log.
      console.error(`Saving ${this.#path} failed:`, error);
      this.#retryLater();
    }
  }

  async #checkDisk(): Promise<void> {
    const file = await this.#vault.read(this.#path);
    if (!file) {
      if (this.#text === this.#base) this.#events.gone();
      else this.#setState('unsaved'); // the next save puts it back
      return;
    }
    await this.#resolve(this.#text, file.text, file.version);
  }

  /** The file holds `diskRaw` at `version`; the editor holds `text`. */
  async #resolve(text: string, diskRaw: string, version: string): Promise<void> {
    const disk = toEditor(diskRaw);
    const change = diskChange(this.#base, text, disk);
    if (change.kind === 'none') return;
    if (change.kind === 'same' || change.kind === 'reload') {
      this.#base = disk;
      this.#version = version;
      this.#format = formatOf(diskRaw);
      if (change.kind === 'reload') {
        this.#text = disk;
        this.#events.replaced(disk);
      }
      this.#setState('saved');
      return;
    }
    await this.#keepAsCopy(text);
  }

  /** Both changed: write the writer's text beside the note and carry on there. */
  async #keepAsCopy(text: string): Promise<void> {
    const from = this.#path;
    const folder = parentOf(from);
    const raw = fromEditor(text, this.#format);
    for (let attempt = 0; attempt < 5; attempt++) {
      const taken = (await this.#vault.list())
        .filter((entry) => parentOf(entry.path) === folder)
        .map((entry) => baseName(entry.path));
      const name = conflictName(baseName(from), this.#now(), taken);
      const path = folder ? `${folder}/${name}` : name;
      const result = await this.#vault.write(path, raw, null);
      if (result.ok) {
        this.#path = path;
        this.#base = text;
        this.#version = result.version;
        this.#events.movedToCopy(path, from);
        return;
      }
    }
    this.#retryLater();
  }

  #retryLater(): void {
    this.#setState('failed');
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#enqueue(() => this.#save()), SAVE_AFTER_MS * 4);
  }

  #setState(state: SaveState): void {
    if (state === this.#state) return;
    this.#state = state;
    this.#events.status(state);
  }

  /** The note's title, from its file name. */
  get title(): string {
    return titleOf(baseName(this.#path));
  }
}
