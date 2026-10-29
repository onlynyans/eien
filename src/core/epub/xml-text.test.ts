import { describe, expect, it } from 'vitest';
import { utf8 } from '../export/zip';
import { xmlOf } from './xml-nodes';
import { xmlText } from './xml-text';

describe('xmlText', () => {
  it('reads UTF-8, as EPUB asks', () => {
    expect(xmlText(utf8('<?xml version="1.0" encoding="UTF-8"?><p>Café “quoted”</p>'))).toContain(
      'Café “quoted”',
    );
  });

  it('reads Latin-1 where an old book’s declaration says so', () => {
    const bytes = Uint8Array.from([
      ...utf8("<?xml version='1.0' encoding='ISO-8859-1'?><p>Caf"),
      0xe9,
      ...utf8('</p>'),
    ]);
    expect(xmlText(bytes)).toContain('<p>Café</p>');
  });

  it('reads Windows-1252’s quotes and dashes where Latin-1 has controls', () => {
    const bytes = Uint8Array.from([
      ...utf8('<?xml version="1.0" encoding="windows-1252"?><p>'),
      0x93,
      ...utf8('Hi'),
      0x94,
      0x97,
      0x80,
      ...utf8('</p>'),
    ]);
    expect(xmlText(bytes)).toContain('<p>“Hi”—€</p>');
  });

  it('reads UTF-16 where its byte-order mark says so, either way round', () => {
    const little = [
      0xff,
      0xfe,
      ...[...'<p>é</p>'].flatMap((c) => [c.charCodeAt(0) & 0xff, c.charCodeAt(0) >> 8]),
    ];
    const big = [
      0xfe,
      0xff,
      ...[...'<p>é</p>'].flatMap((c) => [c.charCodeAt(0) >> 8, c.charCodeAt(0) & 0xff]),
    ];
    expect(xmlText(Uint8Array.from(little))).toBe('<p>é</p>');
    expect(xmlText(Uint8Array.from(big))).toBe('<p>é</p>');
  });

  it('keeps a CDATA section’s words as text, escaped, so nothing in it is read as markup', () => {
    const nodes = xmlOf(
      utf8('<title-group><dc:title><![CDATA[Pride & <Prejudice>]]></dc:title></title-group>'),
    );
    expect(JSON.stringify(nodes)).toContain('Pride & <Prejudice>');
    expect(JSON.stringify(nodes)).not.toContain('"name":"prejudice"');
  });
});
