// Mutation testing (npm run test:mutation; weekly in CI): Stryker changes the
// rules in core and platform one small edit at a time and runs the unit tests
// on each edit. An edit no test notices ("survived") is a rule no test pins
// down. Not ui or app: the window and the main process are proven end to end,
// far too slow to run once per edit.

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  mutate: ['src/core/**/*.ts', 'src/platform/**/*.ts', '!src/**/*.test.ts'],
  // The whole of `vitest run` for each edit, not Stryker's Vitest runner: that one
  // picks a mutant's tests by name as Vitest 4 wrote them ("suite test"); Vitest 5
  // writes "suite > test", so it ran none and every edit "survived". One run per
  // core, each on one worker: run wider, they starve each other into timeouts,
  // which count as caught. Vitest's module cache in node_modules is off, or they
  // clash over it.
  testRunner: 'command',
  commandRunner: { command: 'npx vitest run --bail=1 --no-fsModuleCache --maxWorkers=1' },
  // Slack for a run slowed by the others beside it, so it isn't counted as caught.
  timeoutMS: 15000,
  reporters: ['html', 'json', 'clear-text', 'progress'],
  // Stryker rewrites tsconfig paths that leave the project with TypeScript's
  // JavaScript API, which TypeScript 7 doesn't have. None leave it: nothing to rewrite.
  tsconfigFile: '',
  // The score is reported, never enforced: no change waits on it.
  thresholds: { high: 80, low: 60, break: null },
};
