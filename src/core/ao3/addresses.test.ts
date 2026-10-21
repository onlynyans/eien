import { describe, expect, it } from 'vitest';
import { imageAddresses } from './addresses';

describe('imageAddresses', () => {
  it('finds each image’s address once, as written or by reference, as the writer reads them', () => {
    const body = [
      '![A red scarf](attachments/scarf.png) and ![again](attachments/scarf.png)',
      '![by ref][cover] and ![spaced](<my scarf.png>) and ![escaped](a\\_b.png)',
      '![web](https://example.org/x.png) ![sic] `![code](no.png)`',
      '',
      '[cover]: /art/cover.jpg',
    ].join('\n');
    expect(imageAddresses(body)).toEqual([
      'attachments/scarf.png',
      '/art/cover.jpg',
      'my scarf.png',
      'a_b.png',
      'https://example.org/x.png',
    ]);
  });
});
