// The writer's own themes as the window knows them (spec §7): the files in
// the open vault's .eien/themes, read again when the vault opens and when
// another device changes one, and announced to whatever wears or lists
// them. This is the API Settings' Themes tabs are built on: list, create,
// save, rename and trash the files; mix and verdict for the colours.

import { nameKey } from '../../core/paths';
import {
  isThemePath,
  type Mix,
  mineChoice,
  mixPalette,
  type Palette,
  themeChoice,
  verdictOf,
} from '../../core/themes';
import type { VaultBridge } from '../../platform/bridge';
import { type NameRefused, ThemeFiles, type WriterTheme } from '../../platform/theme-files';
import type { SettingsState } from '../settings/settings-state';

type Listener = (themes: readonly WriterTheme[]) => void;

export class WriterThemes {
  readonly #files: ThemeFiles;
  readonly #settings: SettingsState;
  readonly #listeners = new Set<Listener>();
  #themes: readonly WriterTheme[] = [];
  /** Counts reads, so an older one's answer never replaces a newer one's. */
  #turn = 0;
  /** Mixes shown but not yet written, by name: they stand over what the files say until written. */
  readonly #pending = new Map<string, Mix>();
  /** Saves, one after another, so two writes of one file never race. */
  #saving: Promise<void> = Promise.resolve();

  constructor(vault: VaultBridge, settings: SettingsState) {
    this.#files = new ThemeFiles(vault);
    this.#settings = settings;
    // Another device's theme, changed, made or trashed, shows at once.
    vault.onChange((paths) => {
      if (paths.some(isThemePath)) void this.reload();
    });
  }

  /** Every theme in the open vault, by name; none with no vault open. */
  get list(): readonly WriterTheme[] {
    return this.#themes;
  }

  /** Read the folder again: after a vault opens, or a theme's file changes. */
  async reload(): Promise<void> {
    const turn = ++this.#turn;
    const themes = await this.#files.list().catch(() => [] as WriterTheme[]);
    for (const theme of themes) {
      for (const problem of theme.problems) console.warn(`Eien: ${theme.path}: ${problem}`);
    }
    if (turn === this.#turn) this.#take(themes);
  }

  /** Wear a mix as it's being chosen, before it's saved: a knob being dragged. */
  preview(title: string, mix: Mix): void {
    this.#pending.set(nameKey(title), mix);
    this.#take(this.#themes);
  }

  /** Hear every change; returns a function to stop. */
  onChange(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** A new theme from what the writer typed, numbered when the name is taken. */
  async create(typed: string, mix: Mix): Promise<WriterTheme | NameRefused> {
    const made = await this.#files.create(typed, mix);
    await this.reload();
    return made;
  }

  /** Save a theme's mix: worn at once, written after (throws, with the reason, when it can't be). */
  async save(title: string, mix: Mix): Promise<void> {
    const key = nameKey(title);
    this.#pending.set(key, mix);
    this.#take(this.#themes);
    const saved = this.#saving.then(async () => {
      try {
        await this.#files.write(title, mix);
      } finally {
        if (this.#pending.get(key) === mix) this.#pending.delete(key);
        await this.reload();
      }
    });
    this.#saving = saved.catch(() => undefined);
    return saved;
  }

  /** Rename a theme (its file); the palette setting follows it when it's the one worn. */
  async rename(
    title: string,
    typed: string,
  ): Promise<{ readonly ok: true; readonly title: string } | NameRefused> {
    await this.#saving; // the mix last chosen is in the file before it moves
    const renamed = await this.#files.rename(title, typed);
    if (renamed.ok && this.#worn(title)) {
      await this.reload(); // the new name is there before the setting names it
      await this.#settings.set('appearance.palette', mineChoice(renamed.title));
    } else await this.reload();
    return renamed;
  }

  /** Send a theme to the trash, where the writer can take it back; Paper is worn if it was. */
  async trash(title: string): Promise<void> {
    await this.#saving;
    this.#pending.delete(nameKey(title));
    await this.#files.trash(title);
    if (this.#worn(title)) await this.#settings.set('appearance.palette', 'paper');
    await this.reload();
  }

  /** Every colour of a mix, by day and by night. */
  palette(mix: Mix): Palette {
    return mixPalette(mix);
  }

  /** Whether a mix keeps Eien's contrast, in words. */
  verdict(mix: Mix): { readonly keeps: boolean; readonly words: string } {
    return verdictOf(mixPalette(mix));
  }

  #worn(title: string): boolean {
    const choice = themeChoice(this.#settings.values['appearance.palette']);
    return choice.kind === 'mine' && nameKey(choice.title) === nameKey(title);
  }

  #take(read: readonly WriterTheme[]): void {
    const themes = read.map((theme) => {
      const mix = this.#pending.get(nameKey(theme.title));
      return mix ? { ...theme, mix } : theme;
    });
    this.#themes = themes;
    for (const listener of this.#listeners) listener(themes);
  }
}
