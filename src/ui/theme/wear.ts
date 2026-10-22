// Wearing a theme (spec §7): the palette setting names one, and the window
// wears it on <html>. Paper is tokens.css's own and Slate has its sheet
// (data-palette="slate"); every other theme is its colour tokens set as
// overrides, only known tokens with valid values (safeTokens).

import { nameKey } from '../../core/paths';
import {
  galleryTheme,
  mixPalette,
  type Palette,
  safeTokens,
  THEME_TOKENS,
  themeChoice,
  themeTokens,
} from '../../core/themes';
import type { WriterTheme } from '../../platform/theme-files';

/** What wearing a theme sets: data-palette (none for Paper) and the colours to override, if any. */
export interface Worn {
  readonly attribute: string | undefined;
  readonly palette: Palette | null;
}

const PAPER_WORN: Worn = { attribute: undefined, palette: null };

/**
 * What the palette value `value` wears, given the writer's own themes
 * `mine`: a theme that isn't there (yet: the vault's files come after the
 * window's first draw), or can't be read, is Paper.
 */
export function wornFor(value: string, mine: readonly WriterTheme[]): Worn {
  const choice = themeChoice(value);
  if (choice.kind === 'mine') {
    const key = nameKey(choice.title);
    const theme = mine.find((each) => nameKey(each.title) === key);
    return theme?.mix ? { attribute: 'mine', palette: mixPalette(theme.mix) } : PAPER_WORN;
  }
  const theme = galleryTheme(choice.id);
  if (!theme || theme.id === 'paper') return PAPER_WORN;
  return { attribute: theme.id, palette: theme.inSheet ? null : theme.palette };
}

/** Wear `worn` on `root`: the theme before it is taken off whole. */
export function wear(worn: Worn, root: HTMLElement = document.documentElement): void {
  if (worn.attribute) root.dataset.palette = worn.attribute;
  else delete root.dataset.palette;
  for (const token of THEME_TOKENS) root.style.removeProperty(token);
  if (!worn.palette) return;
  const { tokens, refused } = safeTokens(themeTokens(worn.palette));
  if (refused.length > 0) console.warn('Eien: a theme’s tokens were left out:', refused);
  for (const [token, value] of Object.entries(tokens)) root.style.setProperty(token, value);
}
