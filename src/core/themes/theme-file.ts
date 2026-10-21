// A writer's own theme on disk (spec §2, §7): one file each in the vault's
// .eien/themes/, so it syncs with the notes. The file is named for the
// theme, as a note is for its title, and holds the name and the four
// choices it's mixed from. Keys it doesn't know are kept when it's written.

import { isHiddenName, isValidName, MAX_MADE_NAME_BYTES, safeName, THEMES_FOLDER } from '../paths';
import { withoutBom } from '../text';
import { FIRST_MIX, MIX_KEYS, MIX_RANGE, type Mix } from './mix';

export const THEME_EXTENSION = '.json';

/** The theme a file in .eien/themes is: its name without ".json"; null for a file that isn't one. */
export function themeTitle(fileName: string): string | null {
  if (isHiddenName(fileName) || !fileName.toLowerCase().endsWith(THEME_EXTENSION)) return null;
  const title = fileName.slice(0, -THEME_EXTENSION.length);
  return title.length > 0 && isValidName(fileName) ? title : null;
}

/** Where the theme `title` is kept. */
export const themePath = (title: string): string => `${THEMES_FOLDER}/${title}${THEME_EXTENSION}`;

/** Whether a changed path is a theme's file (another device's change shows at once). */
export function isThemePath(path: string): boolean {
  const folder = `${THEMES_FOLDER}/`;
  if (!path.startsWith(folder)) return false;
  const name = path.slice(folder.length);
  return !name.includes('/') && themeTitle(name) !== null;
}

/** A theme's file name from what the writer typed; null when nothing usable is left. */
export function themeFileName(typed: string): string | null {
  const title = safeName(typed, '', MAX_MADE_NAME_BYTES - THEME_EXTENSION.length);
  return title ? title + THEME_EXTENSION : null;
}

export interface ReadTheme {
  /** The four choices, or null when the file isn't a JSON object (nothing is written over it). */
  readonly mix: Mix | null;
  /** What was ignored, and why, for the log. */
  readonly problems: readonly string[];
}

/** A theme file's text read: a choice missing or out of range takes the first mix's. */
export function readTheme(text: string): ReadTheme {
  const raw = parsed(text);
  if (!isObject(raw)) return { mix: null, problems: ['It isn’t a JSON object.'] };
  const given = isObject(raw.mix) ? raw.mix : {};
  const problems: string[] = isObject(raw.mix)
    ? []
    : ['It has no "mix"; Eien’s first mix is used.'];
  const mix: Record<keyof Mix, number> = { ...FIRST_MIX };
  for (const key of MIX_KEYS) {
    const value = given[key];
    const { min, max } = MIX_RANGE[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max) {
      mix[key] = value;
    } else if (isObject(raw.mix)) {
      problems.push(`mix.${key} must be a number from ${min} to ${max}; using ${FIRST_MIX[key]}.`);
    }
  }
  return { mix, problems };
}

/**
 * A theme file's text with its name and mix set, from the file's text as it
 * is (`before`, null for a new file): every other key stays. Null when
 * `before` isn't a JSON object, which is never written over.
 */
export function themeText(before: string | null, name: string, mix: Mix): string | null {
  const raw = before === null ? {} : parsed(before);
  if (!isObject(raw)) return null;
  const choices = Object.fromEntries(MIX_KEYS.map((key) => [key, mix[key]]));
  const kept = Object.entries(raw).filter(([key]) => key !== 'name' && key !== 'mix');
  // fromEntries defines each key as data, so a "__proto__" in the file stays a plain key.
  const text = Object.fromEntries([['name', name], ...kept, ['mix', choices]]);
  return `${JSON.stringify(text, null, 2)}\n`;
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(withoutBom(text));
  } catch {
    return undefined;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
