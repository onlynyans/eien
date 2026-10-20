// Properties of a note's bytes over generated files: one read into the
// editor and written back is the file as found (spec §2), and whatever a
// file holds, its words survive the trip.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { formatOf, fromEditor, toEditor } from './index';

const BOM = '\uFEFF';

/** A line's text: anything but a line ending, a BOM and "\r" included elsewhere than the start. */
const line = fc.string({ unit: 'binary', maxLength: 20 }).map((s) => s.replace(/[\r\n]/g, ''));
const lines = fc.array(line, { maxLength: 8 });

describe('a note read and written back', () => {
  it('is the file as found, with or without a BOM, in LF or CRLF', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.constantFrom('\n', '\r\n'), lines, (bom, eol, body) => {
        const raw = (bom ? BOM : '') + body.join(eol);
        expect(fromEditor(toEditor(raw), formatOf(raw))).toBe(raw);
      }),
    );
  });

  it('keeps every line of any file, its line endings mixed or old-Mac "\\r"', () => {
    const anyEnding = fc.constantFrom('\n', '\r\n', '\r');
    const mixed = fc
      .tuple(fc.boolean(), fc.array(fc.tuple(line, anyEnding), { maxLength: 8 }), line)
      .map(([bom, parts, last]) => (bom ? BOM : '') + parts.flat().join('') + last);
    fc.assert(
      fc.property(mixed, (raw) => {
        const text = toEditor(raw);
        expect(toEditor(fromEditor(text, formatOf(raw)))).toBe(text);
      }),
    );
  });
});
