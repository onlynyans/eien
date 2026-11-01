// What holds for any link inside a book (#40, Phase 2b): its address on the
// page reads back as the chapter and place it was made from.

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { bookHref, bookLinkOf } from './book-link';

describe('a link inside a book', () => {
  it('comes back as it went, for any clean path and any place in it', () => {
    // A part of a clean path: no "/" or "\\", no control character, not "." or "..", no drive letter.
    const part = fc
      .string({ minLength: 1, maxLength: 12 })
      .filter(
        (each) =>
          each !== '.' &&
          each !== '..' &&
          !/^[a-z]:/iu.test(each) &&
          ![...each].some(
            (char) => char === '/' || char === '\\' || char < ' ' || char === '\u007f',
          ),
      );
    fc.assert(
      fc.property(
        fc.array(part, { minLength: 1, maxLength: 4 }),
        fc.string(),
        (parts, fragment) => {
          const path = parts.join('/');
          return (
            JSON.stringify(bookLinkOf(bookHref({ path, fragment }))) ===
            JSON.stringify({ path, fragment })
          );
        },
      ),
    );
  });
});
