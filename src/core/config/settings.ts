// Reading and writing settings files (spec §6). A bad value never stops the
// app: it's reported and the default is used. Writing keeps every key it
// doesn't know, so an older Eien on another device never drops a newer
// one's settings.

import { EPUB_LOOK } from './epub-look';
import {
  type NumberSetting,
  SETTINGS,
  type Setting,
  type SettingKey,
  type SettingScope,
  type SettingValues,
} from './schema';

/** Every setting by its key: the schema's, and the shelf's look under `epub.` (./epub-look.ts). */
const BY_KEY = new Map<string, Setting>(
  [...SETTINGS, ...EPUB_LOOK].map((setting) => [setting.key, setting]),
);

/** The setting called `key`, if there is one. */
export const settingOf = (key: string): Setting | undefined => BY_KEY.get(key);

/** Every setting at its default. */
export const DEFAULT_SETTINGS = Object.fromEntries(
  [...BY_KEY.values()].map((setting) => [setting.key, setting.default]),
) as SettingValues;

/** Why `value` can't be `setting`'s, or null when it can. */
export function valueProblem(setting: Setting, value: unknown): string | null {
  if (setting.type === 'choice') {
    if (typeof value === 'string' && Object.hasOwn(setting.choices, value)) return null;
    if (typeof value === 'string' && setting.more?.accepts(value)) return null;
    const listed = Object.keys(setting.choices).join(', ');
    return `must be one of ${listed}${setting.more ? `, or ${setting.more.what}` : ''}`;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'must be a number';
  const steps = (value - setting.min) / setting.step;
  if (value < setting.min || value > setting.max || Math.abs(steps - Math.round(steps)) > 1e-9) {
    return `must be ${setting.min} to ${setting.max}, in steps of ${setting.step}`;
  }
  return null;
}

/** The number setting called `key`; throws if `key` isn't one. */
export function numberSetting(key: SettingKey): NumberSetting {
  const setting = settingOf(key);
  if (setting?.type !== 'number') throw new TypeError(`${key} isn’t a number setting.`);
  return setting;
}

/** A number setting `steps` whole steps on from `value`, kept within its range. */
export function stepped(setting: NumberSetting, value: number, steps: number): number {
  return Math.min(setting.max, Math.max(setting.min, value + steps * setting.step));
}

/** One setting, changed: checked against the schema before anything keeps it. */
export interface SettingChange {
  readonly key: SettingKey;
  readonly value: string | number;
}

/** `key` and `value` from outside (IPC, a file) as a change; throws a TypeError when they aren't one. */
export function checkSetting(key: unknown, value: unknown): SettingChange {
  const setting = typeof key === 'string' ? settingOf(key) : undefined;
  if (!setting) throw new TypeError(`There is no setting ${JSON.stringify(key)}.`);
  const problem = valueProblem(setting, value);
  if (problem) throw new TypeError(`${setting.key} ${problem}.`);
  return { key: setting.key as SettingKey, value: value as string | number };
}

export interface ReadSettings {
  /** The valid settings of the scope found in the file. */
  readonly values: Partial<SettingValues>;
  /** What was ignored, and why, for the log. */
  readonly problems: readonly string[];
}

/**
 * The `scope` settings in a file's parsed contents: `undefined` for no file.
 * Anything unknown, misplaced or invalid is left out and reported.
 */
export function readSettings(raw: unknown, scope: SettingScope): ReadSettings {
  if (raw === undefined) return { values: {}, problems: [] };
  if (!isObject(raw)) return { values: {}, problems: ['The settings aren’t a JSON object.'] };
  const values: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const setting = settingOf(key);
    if (!setting) problems.push(`Unknown setting ${JSON.stringify(key)}, kept as it is.`);
    else if (setting.scope !== scope) {
      problems.push(
        `${key} belongs to ${setting.scope === 'vault' ? 'the vault' : 'each device'}; ignored here.`,
      );
    } else {
      const problem = valueProblem(setting, value);
      if (problem) problems.push(`${key} ${problem}; using ${JSON.stringify(setting.default)}.`);
      else values[key] = value;
    }
  }
  return { values: values as Partial<SettingValues>, problems };
}

/** Every setting's value: the first of `chosen` that has it, else its default. */
export function withDefaults(...chosen: readonly Partial<SettingValues>[]): SettingValues {
  return Object.assign({}, DEFAULT_SETTINGS, ...[...chosen].reverse()) as SettingValues;
}

/**
 * A file's parsed contents with one setting changed. Every other key stays,
 * known or not. A default is left out rather than written, so the file holds
 * only what was chosen.
 */
export function withSetting(raw: unknown, { key, value }: SettingChange): Record<string, unknown> {
  const kept = Object.entries(isObject(raw) ? raw : {}).filter(([name]) => name !== key);
  if (value !== settingOf(key)?.default) kept.push([key, value]);
  // fromEntries defines each key as data, so a "__proto__" in the file stays a plain key.
  return Object.fromEntries(kept);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
