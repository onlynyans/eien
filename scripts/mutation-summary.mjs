// Stryker's report (reports/mutation/mutation.json) as Markdown, for the
// weekly job's summary: the mutation score, and the files with the most
// edits no test caught.

import { readFileSync } from 'node:fs';

const report = JSON.parse(
  readFileSync(process.argv[2] ?? 'reports/mutation/mutation.json', 'utf8'),
);

const CAUGHT = new Set(['Killed', 'Timeout']);
const MISSED = new Set(['Survived', 'NoCoverage']);

/** Stryker's score: of the edits the tests could catch, the share they did. */
function score(mutants) {
  const caught = mutants.filter((m) => CAUGHT.has(m.status)).length;
  const missed = mutants.filter((m) => MISSED.has(m.status)).length;
  return caught + missed === 0 ? 100 : (100 * caught) / (caught + missed);
}

const files = Object.entries(report.files).map(([path, { mutants }]) => ({
  path,
  score: score(mutants),
  missed: mutants.filter((m) => MISSED.has(m.status)).length,
}));
const all = Object.values(report.files).flatMap((file) => file.mutants);
const missed = all.filter((m) => MISSED.has(m.status)).length;

const lines = [
  `## Mutation score: ${score(all).toFixed(1)}%`,
  '',
  `${all.length} edits to core and platform; ${missed} no test caught. The full report is the`,
  '`mutation-report` artifact (open `mutation.html`).',
  '',
  '| File | Score | Not caught |',
  '|---|---:|---:|',
  ...files
    .filter((file) => file.missed > 0)
    .sort((a, b) => b.missed - a.missed)
    .slice(0, 25)
    .map((file) => `| \`${file.path}\` | ${file.score.toFixed(1)}% | ${file.missed} |`),
];
console.log(lines.join('\n'));
