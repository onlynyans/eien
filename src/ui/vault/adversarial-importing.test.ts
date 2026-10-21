// Adversarial: the news an import ends with (spec §8: "one line of news says
// how many notes came in"), when the folder held notes and none could be
// written (a full disk, a vault that can't be written). Fails on the code as
// it stands.

import { describe, expect, it } from 'vitest';
import { importNews } from './importing';

describe('importNews', () => {
  it('never says a folder held no notes when its notes couldn’t be written', () => {
    const news = importNews({
      folder: null,
      copied: 0,
      left: [
        { path: 'Ideas.md', reason: 'unwritten' },
        { path: 'Chapter.md', reason: 'unwritten' },
      ],
    });
    expect(news).not.toContain('no notes there');
  });
});
