// Property tests (*.property.test.ts) try the same inputs on every run, so a
// check gives the same answer on every push and a failure reproduces as it
// is. The weekly run sets FC_SEED and FC_RUNS to look further.

import fc from 'fast-check';

const seed = Number(process.env.FC_SEED) || 20261020;
const numRuns = Number(process.env.FC_RUNS) || 100;

fc.configureGlobal({ seed, numRuns });
