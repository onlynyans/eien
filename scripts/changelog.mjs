// npm run changelog -- 0.5.0: CHANGELOG.md's section for a release, from
// main's commit subjects (pull requests' titles, scripts/titles.mjs) since the
// last tag, in Features, Fixes and Other. It takes the place of an Unreleased
// section, or goes above the newest release. A draft: read it and edit it
// before it's committed with the version (AGENTS.md → Releases). With no
// version, it only prints what the section would say. `--since <ref>` starts
// somewhere other than the last tag.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readTitle, TYPES } from './titles.mjs';

const GROUPS = [...new Set(Object.values(TYPES))];
// Before Conventional Commits, and anything that slips past CI's check: kept as written.
const UNREAD = 'Other';

/**
 * A subject as the changelog lists it, and its group.
 * @param {string} subject
 */
export function entryOf(subject) {
  const read = readTitle(subject);
  if (!read.ok) return { group: UNREAD, line: `- ${subject}` };
  const { type, scope, breaking, subject: words, pr } = read.title;
  const line = [
    '-',
    breaking ? '**Breaking:**' : null,
    scope ? `**${scope}:**` : null,
    words,
    pr === null ? null : `(#${pr})`,
  ]
    .filter((part) => part !== null)
    .join(' ');
  return { group: TYPES[type], line };
}

/**
 * The section for `heading` (a version and its date, or "Unreleased"), its subjects oldest first.
 * @param {readonly string[]} subjects
 * @param {string} heading
 */
export function sectionOf(subjects, heading) {
  const entries = subjects.map(entryOf);
  const groups = GROUPS.map((group) => {
    const lines = entries.filter((entry) => entry.group === group).map((entry) => entry.line);
    return lines.length === 0 ? null : `### ${group}\n\n${lines.join('\n')}\n`;
  }).filter((group) => group !== null);
  const body = groups.length === 0 ? 'Nothing since the last release.\n' : groups.join('\n');
  return `## ${heading}\n\n${body}`;
}

/**
 * CHANGELOG.md with `section` in place of its Unreleased section, or above its newest release.
 * @param {string} changelog
 * @param {string} section
 */
export function withSection(changelog, section) {
  const unreleased = /^## Unreleased\n[\s\S]*?(?=^## |(?![\s\S]))/mu;
  if (unreleased.test(changelog)) return changelog.replace(unreleased, `${section}\n`);
  const newest = changelog.search(/^## /mu);
  if (newest === -1) return `${changelog.trimEnd()}\n\n${section}`;
  return `${changelog.slice(0, newest)}${section}\n${changelog.slice(newest)}`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const sinceAt = args.indexOf('--since');
  const since = sinceAt === -1 ? null : args.splice(sinceAt, 2)[1];
  const version = args[0] ?? null;
  const git = (/** @type {string[]} */ ...gitArgs) =>
    execFileSync('git', gitArgs, { encoding: 'utf8' }).trim();
  const from = since ?? git('describe', '--tags', '--abbrev=0', '--match', 'v*');
  const log = git('log', '--first-parent', '--reverse', '--format=%s', `${from}..HEAD`);
  const subjects = log === '' ? [] : log.split('\n');
  const today = new Date().toISOString().slice(0, 10);
  const section = sectionOf(subjects, version ? `${version} — ${today}` : 'Unreleased');
  if (!version) {
    console.log(section);
  } else {
    const path = resolve(fileURLToPath(import.meta.url), '../../CHANGELOG.md');
    writeFileSync(path, withSection(readFileSync(path, 'utf8'), section));
    console.log(`CHANGELOG.md: ${version}, ${subjects.length} changes since ${from}.`);
  }
}
