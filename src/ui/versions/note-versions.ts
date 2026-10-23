// A note's seals (spec §9): sealing the open note, its seals listed and
// read, a seal named, deleted or restored. The rules are in core/versions;
// this does them through the vault, without a page. Nothing here throws at
// the writer: what can't be done comes back with the reason.

import {
  freeVersionFile,
  hasForeignNoteId,
  latestVersion,
  namedVersionFile,
  newNoteId,
  noteIdOf,
  sealsToThin,
  sortedVersions,
  type VersionFile,
  versionsFolderOf,
  withNoteId,
} from '../../core/versions';
import type { VaultBridge } from '../../platform/bridge';
import { reasonOf } from '../reason';
import { fileTarget } from './file-target';

/** The note being sealed: the open one, through its page and session. */
export interface SealTarget {
  readonly path: string;
  /** Whether it's still the note on the page: nothing is put in a note opened since. */
  open(): boolean;
  /** Its text as the editor holds it now. */
  text(): string;
  /**
   * Change its text by `change` (given the text at that moment) as one quiet
   * edit — the caret and the undo history stay — and save it now. False when
   * `change` gives null, the note isn't open or is held still (being moved),
   * or it couldn't be saved. `undoable`: ⌘Z takes the change back.
   */
  amend(change: (text: string) => string | null, undoable: boolean): Promise<boolean>;
  /** Save what's unsaved now; false when it couldn't be, or it isn't open any more. */
  save(): Promise<boolean>;
}

export interface VersionsContext {
  readonly vault: Pick<VaultBridge, 'listFiles' | 'read' | 'write' | 'move' | 'trash'>;
  /** The paths of the notes whose front matter holds `id`, as the vault was last read. */
  notesWithId(id: string): readonly string[];
  /** Ten random bytes, for a new id. */
  random(): Uint8Array;
  now(): number;
  /** The writer's day for a moment, in their own time zone: seals are thinned by it. */
  dayOf(at: number): string;
}

export type SealResult =
  | {
      readonly kind: 'sealed';
      readonly id: string;
      readonly version: VersionFile;
      /** The words sealed. */
      readonly text: string;
    }
  /** Nothing new: the note is as its last seal. */
  | { readonly kind: 'same'; readonly id: string; readonly text: string }
  | { readonly kind: 'refused'; readonly reason: string };

/** How many times a seal (or a restore) is tried again when something moved meanwhile. */
const TRIES = 3;

const NOT_SAVED = 'No version was made: the note couldn’t be saved.';

export class NoteVersions {
  readonly #ctx: VersionsContext;

  constructor(context: VersionsContext) {
    this.#ctx = context;
  }

  /** The seals of the note with `id`, newest first. */
  async list(id: string): Promise<VersionFile[]> {
    return sortedVersions(await this.#ctx.vault.listFiles(versionsFolderOf(id)));
  }

  /** A seal's text; null when it's gone or can't be read just now. */
  async text(id: string, version: VersionFile): Promise<string | null> {
    const file = await this.#ctx.vault
      .read(`${versionsFolderOf(id)}/${version.file}`)
      .catch(() => null);
    return file?.text ?? null;
  }

  /** Seal the note (⌘S): its id first, if it needs one, then a copy of its text. */
  async seal(target: SealTarget): Promise<SealResult> {
    try {
      const id = await this.#idFor(target);
      if (typeof id !== 'string') return id;
      const result = await this.#sealAs(target, id);
      if (result.kind === 'sealed') await this.#thin(id);
      return result;
    } catch (error) {
      return refused(`No version was made: ${reasonOf(error)}`);
    }
  }

  /**
   * Put a seal's text back in the note. The draft is sealed first, so this
   * can be undone (⌘Z too); the note keeps its own id. Words typed while the
   * draft is sealed are sealed as well before they're replaced. Another note
   * opened meanwhile (a slow disk) doesn't stop it: it finishes in the note's
   * own file, off the page.
   */
  async restore(target: SealTarget, id: string, version: VersionFile): Promise<SealResult> {
    try {
      const text = await this.text(id, version);
      if (text === null) return refused('That version no longer exists.');
      const result = await this.#restoreAs(target, text);
      if (result.kind !== 'refused' || target.open()) return result;
      const file = await fileTarget(this.#ctx.vault, target.path);
      return file ? await this.#restoreAs(file, text) : refused('The note isn’t there any more.');
    } catch (error) {
      return refused(`The version wasn’t restored: ${reasonOf(error)}`);
    }
  }

  async #restoreAs(target: SealTarget, text: string): Promise<SealResult> {
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const own = await this.#idFor(target);
      if (typeof own !== 'string') return own;
      const sealed = await this.#sealAs(target, own);
      if (sealed.kind === 'refused') return sealed;
      let typedSince = false;
      const restored = await target.amend((now) => {
        // Typed since the draft was sealed: sealed again before anything is replaced.
        if (now !== sealed.text) {
          typedSince = true;
          return null;
        }
        return withNoteId(text, own) ?? text;
      }, true);
      if (restored) {
        await this.#thin(own);
        return sealed;
      }
      if (!typedSince) {
        return refused(
          'The version couldn’t be restored just now (the note may be moving). Try again.',
        );
      }
    }
    return refused('The note changed while it was being restored. Try again.');
  }

  /** Name a seal (an empty name takes it away); its file, or why it couldn't be named. */
  async name(
    id: string,
    version: VersionFile,
    typed: string,
  ): Promise<VersionFile | { readonly reason: string }> {
    const file = namedVersionFile(version, typed);
    if (file === version.file) return version;
    const folder = versionsFolderOf(id);
    try {
      const moved = await this.#ctx.vault.move(`${folder}/${version.file}`, `${folder}/${file}`);
      if (!moved.ok) {
        return {
          reason:
            moved.reason === 'missing'
              ? 'That version no longer exists.'
              : 'Another version already has that name.',
        };
      }
    } catch (error) {
      return { reason: `The version couldn’t be named: ${reasonOf(error)}` };
    }
    return sortedVersions([file])[0] as VersionFile;
  }

  /** Send a seal to the system's trash; throws, leaving it, when the trash fails. */
  async remove(id: string, version: VersionFile): Promise<void> {
    await this.#ctx.vault.trash(`${versionsFolderOf(id)}/${version.file}`);
  }

  /** Save the note, then write its text as a seal, unless it's as its latest seal. */
  async #sealAs(target: SealTarget, id: string): Promise<SealResult> {
    if (!(await target.save())) {
      return refused(
        target.open() ? NOT_SAVED : 'No version was made: another note was opened first.',
      );
    }
    const text = target.text();
    for (let attempt = 0; attempt < TRIES; attempt++) {
      const files = await this.#ctx.vault.listFiles(versionsFolderOf(id));
      const now = this.#ctx.now();
      // The latest not from a clock ahead of this one; one that can't be read isn't "the same".
      const latest = latestVersion(sortedVersions(files), now);
      if (latest && (await this.text(id, latest)) === text) return { kind: 'same', id, text };
      const file = freeVersionFile(now, files);
      const written = await this.#ctx.vault.write(`${versionsFolderOf(id)}/${file}`, text, null);
      if (written.ok) {
        return { kind: 'sealed', id, version: sortedVersions([file])[0] as VersionFile, text };
      }
    }
    return refused('Another device was saving a version of this note at the same time. Try again.');
  }

  /**
   * The id the note's seals go under. A note without one is given one, in its
   * front matter; so is a note sharing its id with another (a copied file),
   * which takes the seals so far along with it, so neither loses its history.
   */
  async #idFor(target: SealTarget): Promise<string | SealResult> {
    const text = target.text();
    const id = noteIdOf(text);
    const shared = id !== null && this.#ctx.notesWithId(id).some((path) => path !== target.path);
    if (id !== null && !shared) return id;
    // Another tool's id, one that can't name a folder: never written over.
    if (id === null && hasForeignNoteId(text)) {
      return refused('No version was made: the note’s id can’t be used as a folder name.');
    }
    const fresh = newNoteId(this.#ctx.random());
    if (withNoteId(text, fresh) === null) {
      return refused(
        'No version was made: Eien can’t add an id to this note’s front matter, as it isn’t a list of keys.',
      );
    }
    if (id !== null) await this.#copySeals(id, fresh);
    // The id goes into the text as it is now: words typed meanwhile and all.
    if (!(await target.amend((now) => withNoteId(now, fresh), false))) {
      return refused(
        target.open()
          ? 'No version was made: the note couldn’t be given an id just now (it may be moving). Try again.'
          : 'No version was made: another note was opened first.',
      );
    }
    return fresh;
  }

  async #copySeals(from: string, to: string): Promise<void> {
    for (const version of await this.list(from)) {
      const text = await this.text(from, version);
      if (text !== null) {
        await this.#ctx.vault.write(`${versionsFolderOf(to)}/${version.file}`, text, null);
      }
    }
  }

  /** Old seals thinned (spec §9), to the system's trash; one the trash refuses stays. */
  async #thin(id: string): Promise<void> {
    const versions = await this.list(id).catch(() => []);
    for (const version of sealsToThin(versions, this.#ctx.now(), this.#ctx.dayOf)) {
      await this.remove(id, version).catch(() => {});
    }
  }
}

const refused = (reason: string): SealResult => ({ kind: 'refused', reason });
