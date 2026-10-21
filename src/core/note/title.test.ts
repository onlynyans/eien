import { describe, expect, it } from 'vitest';
import { opensWithTitle } from './title';

describe('opensWithTitle', () => {
  it('a note whose first line is its title as a heading', () => {
    expect(opensWithTitle('# Tear\n\nThe scarf tore.', 'Tear')).toBe(true);
    expect(opensWithTitle('#   tear  ##\n', 'Tear')).toBe(true); // closing #s, case, spaces
  });

  it('after front matter (a seal’s id), and blank lines', () => {
    expect(opensWithTitle('---\nid: a1\n---\n\n# Tear\n', 'Tear')).toBe(true);
  });

  it('not another heading, a deeper one’s words, or the title later on', () => {
    expect(opensWithTitle('# Mend\n', 'Tear')).toBe(false);
    expect(opensWithTitle('The scarf.\n# Tear\n', 'Tear')).toBe(false);
    expect(opensWithTitle('#Tear\n', 'Tear')).toBe(false); // a tag, not a heading
    expect(opensWithTitle('', 'Tear')).toBe(false);
  });

  it('only a first-level heading stands in for the title', () => {
    expect(opensWithTitle('## Tear\n', 'Tear')).toBe(false);
  });
});
