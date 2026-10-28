// A pull request's title, which its squash merge makes main's commit subject:
// Conventional Commits, `type(scope): subject`, with `!` before the colon for a
// change that breaks a vault's files or settings (AGENTS.md → Releases). CI
// runs this on every pull request's title; scripts/changelog.mjs reads main's
// subjects with it.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Each type, and the changelog's group for it. @type {Readonly<Record<string, string>>} */
export const TYPES = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Other',
  refactor: 'Other',
  docs: 'Other',
  test: 'Other',
  ci: 'Other',
  build: 'Other',
  chore: 'Other',
};

const TITLE = /^(?<type>[a-z]+)(?:\((?<scope>[^()]*)\))?(?<breaking>!)?: (?<subject>.*)$/u;
// GitHub's squash merge adds the pull request's number.
const NUMBER = / \(#(\d+)\)$/u;

/**
 * @typedef {{ type: string, scope: string | null, breaking: boolean, subject: string, pr: number | null }} Title
 */

/**
 * The parts of a title, or what's wrong with it.
 * @param {string} title
 * @returns {{ ok: true, title: Title } | { ok: false, problem: string }}
 */
export function readTitle(title) {
  const pr = NUMBER.exec(title);
  const parts = TITLE.exec(pr ? title.slice(0, pr.index) : title)?.groups;
  if (!parts?.type || parts.subject === undefined)
    return { ok: false, problem: 'It isn\'t "type(scope): subject" or "type: subject".' };
  const { type, scope, breaking, subject } = parts;
  if (!Object.hasOwn(TYPES, type)) {
    return { ok: false, problem: `"${type}" isn't one of ${Object.keys(TYPES).join(', ')}.` };
  }
  if (scope !== undefined && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(scope)) {
    return {
      ok: false,
      problem: `The scope "${scope}" is one lower-case word, or words-with-hyphens.`,
    };
  }
  if (subject.trim() !== subject || subject === '') {
    return {
      ok: false,
      problem: 'The subject comes right after ": ", with no space before or after it.',
    };
  }
  // A capitalised first word ("A", "Fix") reads as a sentence; a name in capitals (EPUB, AO3) is kept.
  if (/^\p{Lu}(?:\p{Ll}|\s)/u.test(subject)) {
    return { ok: false, problem: `The subject starts in lower case: "${lowerFirst(subject)}".` };
  }
  if (subject.endsWith('.')) return { ok: false, problem: 'The subject has no full stop.' };
  return {
    ok: true,
    title: {
      type,
      scope: scope ?? null,
      breaking: breaking === '!',
      subject,
      pr: pr ? Number(pr[1]) : null,
    },
  };
}

/** @param {string} text */
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const title = process.argv[2] ?? '';
  const read = readTitle(title);
  if (read.ok) {
    console.log(`"${title}" is a conventional title.`);
  } else {
    console.error(`"${title}": ${read.problem}`);
    console.error('A title is type(scope): subject, as AGENTS.md → Releases says.');
    process.exit(1);
  }
}
