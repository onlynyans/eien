// Which theme is worn (spec §7): the palette setting's value names one of
// the gallery's by its id, or one of the writer's own as "mine:" and its
// name. The writer's own can't be listed in the schema, so this decides
// which values are theirs.

import { galleryTheme } from './gallery';
import { THEME_EXTENSION, themeTitle } from './theme-file';

const MINE = 'mine:';

export type ThemeChoice =
  | { readonly kind: 'gallery'; readonly id: string }
  | { readonly kind: 'mine'; readonly title: string };

/** The palette setting's value for the writer's own theme `title`. */
export const mineChoice = (title: string): string => MINE + title;

/** Whether `value` names one of the writer's own themes by a name a theme file can have. */
export const isMineChoice = (value: string): boolean =>
  value.startsWith(MINE) && themeTitle(value.slice(MINE.length) + THEME_EXTENSION) !== null;

/** The theme a palette value names; Washi for one that names none. */
export function themeChoice(value: string): ThemeChoice {
  if (isMineChoice(value)) return { kind: 'mine', title: value.slice(MINE.length) };
  return { kind: 'gallery', id: galleryTheme(value)?.id ?? 'washi' };
}
