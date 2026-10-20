// Where a note's seals live, and what their files are called (spec §9):
// .eien/versions/<note id>/2026-10-19T16-40-02Z.md, and a named seal
// 2026-10-19T17-02-11Z--before the rewrite.md. Two seals in one second are
// told apart by a count: 2026-10-19T16-40-02Z~2.md.

import { MAX_MADE_NAME_BYTES, safeName, utf8Length } from '../paths';

export const VERSIONS_FOLDER = '.eien/versions';

/** The folder holding the seals of the note with `id`. */
export const versionsFolderOf = (id: string): string => `${VERSIONS_FOLDER}/${id}`;

export interface VersionFile {
  /** The file's name in the note's versions folder. */
  readonly file: string;
  /** When it was sealed, in milliseconds since 1970 (UTC, to the second). */
  readonly at: number;
  /** Its name, for a named seal; null for one that isn't. */
  readonly name: string | null;
  /** 1, or more for a later seal in the same second. */
  readonly count: number;
}

const FILE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z(?:~([1-9]\d{0,5}))?(?:--(.+))?\.md$/;

const two = (n: number) => String(n).padStart(2, '0');

/** "2026-10-19T16-40-02Z": the time, in UTC, as a file can be named on every system. */
export function versionStamp(at: number): string {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}T${two(d.getUTCHours())}-${two(d.getUTCMinutes())}-${two(d.getUTCSeconds())}Z`;
}

/** The file for a seal made at `at`; `count` above 1 for a later one in the same second. */
export function versionFileName(at: number, name: string | null = null, count = 1): string {
  const head = `${versionStamp(at)}${count > 1 ? `~${count}` : ''}`;
  return name ? `${head}--${name}.md` : `${head}.md`;
}

/** What a file in a versions folder is; null for one that isn't a seal (left alone). */
export function parseVersionFile(file: string): VersionFile | null {
  const match = FILE.exec(file);
  if (!match) return null;
  const [, y, mo, d, h, mi, s, count, name] = match;
  const at = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  // A date that doesn't exist (February 30th) isn't one of ours.
  if (versionStamp(at) !== file.slice(0, 20)) return null;
  return { file, at, name: name ?? null, count: count ? Number(count) : 1 };
}

/** The seals among `files`, newest first. */
export function sortedVersions(files: Iterable<string>): VersionFile[] {
  const versions: VersionFile[] = [];
  for (const file of files) {
    const version = parseVersionFile(file);
    if (version) versions.push(version);
  }
  return versions.sort(
    (a, b) => b.at - a.at || b.count - a.count || (a.file < b.file ? -1 : a.file > b.file ? 1 : 0),
  );
}

/** How far ahead of this clock another device's may be before its seals aren't "the latest". */
const CLOCK_SKEW_MS = 60_000;

/**
 * The latest of `versions` (newest first) at `now`: the newest not dated in
 * the future. A seal from a device whose clock runs ahead would otherwise be
 * "the latest" until that time comes, and every seal made here would look
 * newer than none of them. Only when all are ahead is the newest taken.
 */
export function latestVersion(versions: readonly VersionFile[], now: number): VersionFile | null {
  return versions.find((v) => v.at <= now + CLOCK_SKEW_MS) ?? versions[0] ?? null;
}

/** The file name for the next seal made at `at`, free among `taken`. */
export function freeVersionFile(at: number, taken: Iterable<string>): string {
  const stamp = versionStamp(at);
  let count = 0;
  for (const file of taken) {
    const version = parseVersionFile(file);
    if (version && versionStamp(version.at) === stamp) count = Math.max(count, version.count);
  }
  return versionFileName(at, null, count + 1);
}

/**
 * `version`'s file named `typed`, cleaned as any name Eien makes (spec §3)
 * and cut to fit; an empty name takes the name away.
 */
export function namedVersionFile(version: VersionFile, typed: string): string {
  const head = versionFileName(version.at, null, version.count).slice(0, -'.md'.length);
  const room = MAX_MADE_NAME_BYTES - utf8Length(`${head}--.md`);
  const name = safeName(typed, '', room);
  return versionFileName(version.at, name || null, version.count);
}
