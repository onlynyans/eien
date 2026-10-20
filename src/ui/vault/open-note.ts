// The note open on the page: its session (saving and reloading), its
// images, and what the page shows of it.

import { baseName, parentOf, titleOf } from '../../core/paths';
import type { VaultBridge } from '../../platform/bridge';
import { type NoteImages, noteImages } from '../editor/image-loader';
import { NoteSession } from '../notes/note-session';
import type { PageView } from '../page/page';

/** The folders above a note, as the page shows them: "Fic / A Mended Scarf". */
export const crumbsOf = (path: string): string =>
  parentOf(path).split('/').filter(Boolean).join(' / ');

export class OpenNote {
  #session: NoteSession | null = null;
  #images: NoteImages | null = null;
  /** The folder the images are read from: the note's, when it was opened or last moved. */
  #imagesFolder = '';
  readonly #vault: VaultBridge;
  readonly #page: PageView;
  /** The vault changed under it (its text kept as a copy): read the vault again. */
  readonly #changed: () => void;

  constructor(vault: VaultBridge, page: PageView, changed: () => void) {
    this.#vault = vault;
    this.#page = page;
    this.#changed = changed;
  }

  get session(): NoteSession | null {
    return this.#session;
  }

  get path(): string | null {
    return this.#session?.path ?? null;
  }

  /** Open the note at `path`, once the one open now has saved. */
  async open(path: string): Promise<void> {
    await this.#session?.flush();
    const page = this.#page;
    this.#session = await NoteSession.open(this.#vault, path, {
      status: (saveState) => page.state(saveState),
      replaced: (text) => page.replaceText(text),
      movedToCopy: (copy, from) => {
        page.retitle(titleOf(baseName(copy)), crumbsOf(copy));
        page.notice(
          `“${titleOf(baseName(from))}” changed elsewhere. Your version is kept beside it as “${titleOf(baseName(copy))}”.`,
        );
        this.#changed();
      },
      gone: () => this.close(),
    });
    this.#images?.release();
    this.#images = this.#session
      ? noteImages(parentOf(path), (file) => this.#vault.readBytes(file))
      : null;
    this.#imagesFolder = parentOf(path);
    if (this.#session && this.#images) {
      page.show({
        crumbs: crumbsOf(path),
        title: this.#session.title,
        text: this.#session.text,
        loadImage: this.#images.load,
      });
    } else page.showNothing();
  }

  /** The note moved (renamed, or into another folder): the page names it, and finds its images, there. */
  followMove(): void {
    const path = this.path;
    if (!path || !this.#session) return;
    this.#page.retitle(titleOf(baseName(path)), crumbsOf(path));
    if (this.#imagesFolder === parentOf(path)) return;
    this.#images?.release();
    this.#images = noteImages(parentOf(path), (file) => this.#vault.readBytes(file));
    this.#imagesFolder = parentOf(path);
    this.#page.editor.setImageLoader(this.#images.load);
  }

  /** Nothing open: the note's gone (deleted elsewhere, or sent to the trash here). */
  close(): void {
    this.#session?.close();
    this.#session = null;
    this.#images?.release();
    this.#images = null;
    this.#page.showNothing();
  }

  /** Save whatever is unsaved. */
  async flush(): Promise<void> {
    await this.#session?.flush();
  }
}
