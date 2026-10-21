// The writer's own themes (spec §7): one file each in .eien/themes/, read,
// written, renamed and trashed through the Storage contract, so the window
// and the phone keep them as they keep notes. Names are compared as the
// storage compares them (nameKey): no two themes differ only in case. A
// theme sent away goes to the trash, where the writer can take it back.

import { nameKey, THEMES_FOLDER } from '../core/paths';
import {
  type Mix,
  readTheme,
  THEME_EXTENSION,
  themeFileName,
  themePath,
  themeText,
  themeTitle,
} from '../core/themes';
import type { Storage } from './storage';

/** What theme files need of a vault: the Storage contract's, or the window's bridge to it. */
export type ThemeStorage = Pick<Storage, 'listFiles' | 'read' | 'write' | 'move' | 'trash'>;

/** One of the writer's themes, as its file is now. */
export interface WriterTheme {
  /** Its name: the file's, without ".json". */
  readonly title: string;
  readonly path: string;
  /** The four choices; null when the file can't be read as a theme (it's never written over). */
  readonly mix: Mix | null;
  /** What in the file was ignored, and why. */
  readonly problems: readonly string[];
}

/** Why a name can't be had: nothing usable typed, or another theme has it. */
export type NameRefused = { readonly ok: false; readonly problem: 'empty' | 'taken' };

/** How many times a write is tried while the file keeps changing under it. */
const WRITE_TRIES = 3;

export class ThemeFiles {
  readonly #storage: ThemeStorage;

  constructor(storage: ThemeStorage) {
    this.#storage = storage;
  }

  /** Every theme in the folder, by name; none when there's no folder. */
  async list(): Promise<WriterTheme[]> {
    const titles = (await this.#storage.listFiles(THEMES_FOLDER))
      .map(themeTitle)
      .filter((title): title is string => title !== null)
      .sort((a, b) => a.localeCompare(b));
    const read = await Promise.all(titles.map((title) => this.read(title)));
    return read.filter((theme): theme is WriterTheme => theme !== null);
  }

  /** The theme called `title`, or null when there's no such file. */
  async read(title: string): Promise<WriterTheme | null> {
    const path = themePath(title);
    const file = await this.#storage.read(path);
    if (!file) return null;
    const { mix, problems } = readTheme(file.text);
    return { title, path, mix, problems };
  }

  /**
   * A new theme from what the writer typed, numbered when the name is taken
   * ("Untitled 2"), as a new note is.
   */
  async create(typed: string, mix: Mix): Promise<WriterTheme | NameRefused> {
    const first = themeFileName(typed);
    if (!first) return { ok: false, problem: 'empty' };
    const base = first.slice(0, -THEME_EXTENSION.length);
    const taken = new Set((await this.#storage.listFiles(THEMES_FOLDER)).map(nameKey));
    for (let n = 1; n < 1000; n++) {
      const title = n === 1 ? base : `${base} ${n}`;
      if (taken.has(nameKey(title + THEME_EXTENSION))) continue;
      const text = themeText(null, title, mix) as string;
      // Refused only when a file (or its case twin) arrived meanwhile: try the next number.
      if ((await this.#storage.write(themePath(title), text, null)).ok) {
        return { title, path: themePath(title), mix, problems: [] };
      }
    }
    return { ok: false, problem: 'taken' };
  }

  /**
   * Save `title`'s new mix, keeping every other key in its file. Throws
   * when the file is gone, can't be read as JSON (never written over), or
   * kept changing under the write.
   */
  async write(title: string, mix: Mix): Promise<void> {
    const path = themePath(title);
    for (let attempt = 0; attempt < WRITE_TRIES; attempt++) {
      const file = await this.#storage.read(path);
      if (!file) throw new Error(`The theme “${title}” isn’t there any more.`);
      const text = themeText(file.text, title, mix);
      if (text === null)
        throw new Error(`${path} isn’t valid JSON. Fix or remove it, then try again.`);
      if ((await this.#storage.write(path, text, file.version)).ok) return;
    }
    throw new Error(`${path} kept changing; the theme wasn’t saved.`);
  }

  /**
   * Rename `title` to what the writer typed: the file is renamed. A change
   * of case alone is the same theme; a name another theme has is refused,
   * never numbered, since the writer chose it.
   */
  async rename(
    title: string,
    typed: string,
  ): Promise<{ readonly ok: true; readonly title: string } | NameRefused> {
    const name = themeFileName(typed);
    if (!name) return { ok: false, problem: 'empty' };
    const next = name.slice(0, -THEME_EXTENSION.length);
    if (next === title) return { ok: true, title };
    const from = themePath(title);
    const others = (await this.#storage.listFiles(THEMES_FOLDER)).filter(
      (each) => nameKey(each) !== nameKey(title + THEME_EXTENSION),
    );
    if (others.some((each) => nameKey(each) === nameKey(name))) {
      return { ok: false, problem: 'taken' };
    }
    const moved = await this.#storage.move(from, themePath(next));
    if (!moved.ok) {
      if (moved.reason === 'taken') return { ok: false, problem: 'taken' };
      throw new Error(`The theme “${title}” isn’t there any more.`);
    }
    await this.#renameInside(next).catch(console.warn); // the file's name is what counts
    return { ok: true, title: next };
  }

  /** Send `title`'s file to the trash, where the writer can take it back; throws when it can't. */
  trash(title: string): Promise<void> {
    return this.#storage.trash(themePath(title));
  }

  /** The name written inside the file follows its new file name. */
  async #renameInside(title: string): Promise<void> {
    const theme = await this.read(title);
    // A file with something wrong in its mix keeps it as it is, for the writer to see.
    if (theme?.mix && theme.problems.length === 0) await this.write(title, theme.mix);
  }
}
