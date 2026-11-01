// The twisty turns (#56): ../src/ui/sidebar/tree.css turns it by its button's
// aria-expanded, or, for a twisty that's the pointer's alone (SHELF's folders,
// whose name holds aria-expanded), by its data-open (../src/ui/sidebar/twist.ts).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const TREE = readFileSync(
  resolve(import.meta.dirname, '../src/ui/sidebar/tree.css'),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

describe('the twisty', () => {
  it('turns by aria-expanded and by a pointer twisty’s data-open alike', () => {
    const turns = TREE.slice(0, TREE.indexOf('transform: rotate(90deg)'));
    const selector = turns.slice(turns.lastIndexOf('}') + 1, turns.lastIndexOf('{'));
    expect(selector).toContain('[aria-expanded="true"]');
    expect(selector).toContain('[data-open="true"]');
    expect(selector).toContain('> .twisty::before');
  });
});
