// Seals on the page (spec §9): Seal (⌘S) keeps the note as it is; Compare
// (⌘⇧D) shows the changes since a seal, then the seal alone, then the draft
// again; Versions lists the note's seals, to compare, restore, name or
// delete. The colophon says when the note was last sealed. The three are
// commands the layout draws (../chrome), as this says they are now.

import { readNote } from '../../core/note';
import { baseName, titleOf } from '../../core/paths';
import { latestVersion, noteIdOf, type VersionFile, versionsFolderOf } from '../../core/versions';
import type { VaultBridge } from '../../platform/bridge';
import type { PageView } from '../page/page';
import type { OpenNote } from '../vault/open-note';
import { compareView } from './compare-view';
import { NoteVersions, type SealTarget } from './note-versions';
import { type CompareMode, SealLine } from './seal-line';
import { sealTargetOf } from './seal-target';
import { localDay, sealedWhen } from './seal-time';
import { VersionsPanel } from './versions-panel';

export interface VersionsParts {
  readonly page: PageView;
  readonly note: OpenNote;
  readonly vault: VaultBridge;
  /** The paths of the notes holding `id`, from the vault's index. */
  notesWithId(id: string): readonly string[];
  readonly mac: boolean;
  /** News, where the window shows it. */
  tell(message: string): void;
  /**
   * Run `operation` after the file operations under way (a rename holds the
   * note still while it moves): a seal pressed meanwhile waits, then seals.
   */
  serial(operation: () => Promise<unknown>): Promise<void>;
  /** What Compare and Versions show changed: the controls show it too. */
  changed(): void;
}

const wordsOf = (text: string) => readNote(text, '').words;

export class VersionsUI {
  readonly #parts: VersionsParts;
  readonly #versions: NoteVersions;
  readonly #panel: VersionsPanel;
  readonly #line = new SealLine();
  /** The open note's session, as last seen: a new one is another note. */
  #session: OpenNote['session'] = null;
  #id: string | null = null;
  #seals: VersionFile[] = [];
  readonly #words = new Map<string, number>();
  #mode: CompareMode = 'draft';
  /** The seal compared with, or shown: the newest unless one was chosen in the panel. */
  #against: VersionFile | null = null;
  readonly #ticker: ReturnType<typeof setInterval>;
  /** Counts loads, so an older note's seals can't land on a newer one. */
  #loads = 0;
  /** Counts Compare's showings, so a slow one can't land after a newer one, or after Draft. */
  #shows = 0;

  constructor(parts: VersionsParts) {
    this.#parts = parts;
    this.#versions = new NoteVersions({
      vault: parts.vault,
      notesWithId: parts.notesWithId,
      random: () => crypto.getRandomValues(new Uint8Array(10)),
      now: () => Date.now(),
      dayOf: localDay,
    });
    this.#panel = new VersionsPanel({
      close: () => this.showPanel(false),
      compare: (version) => void this.#compareWith(version),
      restore: (version) => void this.#restore(version),
      name: (version, typed) => void this.#name(version, typed),
      remove: (version) => void this.#remove(version),
    });
    parts.page.attach({ sealLine: this.#line.line, aside: this.#panel.element });
    this.#ticker = setInterval(() => this.#draw(), 60_000); // "2h ago" moves on
    this.#draw();
  }

  /** Called on every redraw: another note open (or none) is seen here. */
  sync(): void {
    const session = this.#parts.note.session;
    if (session !== this.#session) {
      this.#session = session;
      void this.noteChanged();
    } else if (session && noteIdOf(session.text) !== this.#id) {
      void this.#load(); // its id changed (a reload from another device, a seal): its seals too
    }
  }

  /** Another note is open (or none): back to the draft, and its seals read. */
  async noteChanged(): Promise<void> {
    this.#setMode('draft');
    this.#against = null;
    this.#words.clear();
    await this.#load();
  }

  /** Something in the vault changed: the open note's seals are read again if theirs did. */
  async diskChanged(paths: ReadonlySet<string>): Promise<void> {
    const folder = this.#id ? `${versionsFolderOf(this.#id)}/` : null;
    if (folder && [...paths].some((path) => path.startsWith(folder))) await this.#load();
  }

  /** ⌘S: seal the open note, once a rename or move under way is done. */
  seal(): Promise<void> {
    return this.#parts.serial(() => this.#seal());
  }

  async #seal(): Promise<void> {
    const target = this.#target();
    if (!target) return;
    const result = await this.#versions.seal(target);
    if (result.kind === 'refused') return this.#parts.tell(result.reason);
    if (!target.open()) return; // sealed, but another note is on the page now
    this.#id = result.id;
    if (result.kind === 'same') this.#line.say('No changes since the last version');
    else this.#line.stamp();
    await this.#load();
    // Compare was showing the last seal: it shows the one just made.
    if (this.#mode !== 'draft' && this.#against === null) await this.#show(this.#mode);
  }

  /** ⌘⇧D: Changes, then the seal alone, then the draft. */
  /** The next of draft → changes → sealed, or `to` (a phone's back: the draft). */
  async cycleCompare(to?: CompareMode): Promise<void> {
    if (!this.#parts.note.session) return;
    if (this.#seals.length === 0) return this.#line.say('No versions to compare yet');
    const after =
      this.#mode === 'draft' ? 'changes' : this.#mode === 'changes' ? 'sealed' : 'draft';
    await this.#show(to ?? after);
  }

  /** Whether the versions panel is open. */
  get panelOpen(): boolean {
    return this.#panel.open;
  }

  /** What Compare shows: the draft, the changes since a seal, or the seal alone. */
  get compareMode(): CompareMode {
    return this.#mode;
  }

  /** Whether Compare has anything to show: a note open, and sealed. */
  get canCompare(): boolean {
    return this.#parts.note.session !== null && this.#seals.length > 0;
  }

  showPanel(open: boolean): void {
    if (open && !this.#parts.note.session) return;
    this.#panel.show(open);
    this.#draw();
    if (open) this.#panel.focus();
    else this.#parts.page.focus();
  }

  stop(): void {
    clearInterval(this.#ticker);
  }

  #target(): SealTarget | null {
    return sealTargetOf(this.#parts.note, this.#parts.page);
  }

  async #load(): Promise<void> {
    const load = ++this.#loads;
    const session = this.#parts.note.session;
    const id = session ? noteIdOf(session.text) : null;
    const seals = id ? await this.#versions.list(id).catch(() => []) : [];
    if (load !== this.#loads) return;
    this.#id = id;
    this.#seals = seals;
    // A seal compared with that's gone (deleted, thinned): the newest instead, or the draft.
    if (this.#against && !seals.some((v) => v.file === this.#against?.file)) this.#against = null;
    if (this.#mode !== 'draft' && seals.length === 0) this.#setMode('draft');
    this.#draw();
    await this.#countWords(load);
  }

  async #countWords(load: number): Promise<void> {
    const id = this.#id;
    if (!id || !this.#panel.open) return;
    for (const version of this.#seals) {
      if (this.#words.has(version.file)) continue;
      const text = await this.#versions.text(id, version);
      if (load !== this.#loads) return;
      if (text !== null) this.#words.set(version.file, wordsOf(text));
    }
    this.#draw();
  }

  /** The seal Compare shows: the one chosen in the panel, or the latest. */
  #compared(): VersionFile | null {
    return this.#against ?? latestVersion(this.#seals, Date.now());
  }

  async #show(mode: CompareMode): Promise<void> {
    const show = ++this.#shows;
    const against = this.#compared();
    const session = this.#parts.note.session;
    if (mode === 'draft' || !against || !this.#id || !session) return this.#setMode('draft');
    const seal = await this.#versions.text(this.#id, against);
    // Another note opened, or another Compare asked for, while the seal was read: not this one.
    if (show !== this.#shows || this.#parts.note.session !== session) return;
    if (seal === null) {
      await this.#load();
      return this.#parts.tell('That version no longer exists.');
    }
    const label = { name: against.name, when: sealedWhen(against.at, Date.now()) };
    const showing =
      mode === 'changes'
        ? { kind: 'changes' as const, seal, draft: session.text }
        : { kind: 'sealed' as const, seal };
    this.#parts.page.compare(compareView(showing, label, (key) => this.#backToDraft(key)));
    this.#mode = mode;
    this.#draw();
  }

  /** Typing in Compare: the draft again, with the key typed into it (unless it's read only). */
  #backToDraft(key: string | null): void {
    this.#setMode('draft');
    const editor = this.#parts.page.editor;
    editor.focus();
    const { state } = editor.view;
    if (key && !state.readOnly) {
      editor.view.dispatch(state.replaceSelection(key), { userEvent: 'input.type' });
    }
  }

  #setMode(mode: CompareMode): void {
    if (mode === 'draft') this.#shows++; // a Compare still reading its seal isn't shown
    this.#mode = mode;
    if (mode === 'draft') this.#parts.page.compare(null);
    this.#draw();
  }

  async #compareWith(version: VersionFile): Promise<void> {
    const same = this.#against?.file === version.file && this.#mode === 'changes';
    this.#against = same ? null : version;
    await this.#show(same ? 'draft' : 'changes');
  }

  #restore(version: VersionFile): Promise<void> {
    return this.#parts.serial(() => this.#restoreNow(version));
  }

  async #restoreNow(version: VersionFile): Promise<void> {
    const target = this.#target();
    if (!target || !this.#id) return;
    this.#setMode('draft');
    const result = await this.#versions.restore(target, this.#id, version);
    if (result.kind === 'refused') return this.#parts.tell(result.reason);
    // Another note is on the page now: the restore was finished in the note's own file.
    if (!target.open()) {
      return this.#parts.tell(
        `“${titleOf(baseName(target.path))}” is restored. Its previous draft was saved as a version first.`,
      );
    }
    this.#line.say('Restored. The previous draft was saved as a version');
    await this.#load();
  }

  async #name(version: VersionFile, typed: string): Promise<void> {
    if (!this.#id) return;
    const named = await this.#versions.name(this.#id, version, typed);
    if ('reason' in named) this.#parts.tell(named.reason);
    else if (this.#against?.file === version.file) this.#against = named;
    await this.#load();
  }

  async #remove(version: VersionFile): Promise<void> {
    if (!this.#id) return;
    try {
      await this.#versions.remove(this.#id, version);
    } catch (error) {
      this.#parts.tell(
        `The version couldn’t be moved to the trash, so it was kept: ${String(error)}`,
      );
      return;
    }
    // The seal Compare shows (chosen, or the latest) is gone: the draft again.
    if (this.#mode !== 'draft' && this.#compared()?.file === version.file) this.#setMode('draft');
    if (this.#against?.file === version.file) this.#against = null;
    this.#parts.tell('The version was moved to the trash.');
    await this.#load();
  }

  #draw(): void {
    const now = Date.now();
    const session = this.#parts.note.session;
    const latest = latestVersion(this.#seals, now);
    this.#line.draw(session !== null, latest?.at ?? null);
    this.#parts.changed();
    if (!this.#panel.open) return;
    const draftWords = session ? wordsOf(session.text) : 0;
    this.#panel.draw({
      draftWords,
      seals: this.#seals.map((version) => ({
        version,
        when: `Sealed ${sealedWhen(version.at, now)}`,
        words: this.#words.get(version.file) ?? null,
      })),
      compared: this.#mode === 'draft' ? null : (this.#compared()?.file ?? null),
      sealKeys: this.#parts.mac ? '⌘S' : 'Ctrl+S',
    });
    if (this.#seals.some((v) => !this.#words.has(v.file))) void this.#countWords(this.#loads);
  }
}
