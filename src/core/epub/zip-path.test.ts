import { describe, expect, it } from 'vitest';
import { inZip, isZipPath } from './zip-path';

describe('isZipPath', () => {
  it('takes a clean relative path, a folder’s own entry too', () => {
    for (const name of [
      'mimetype',
      'OEBPS/content.opf',
      'OEBPS/Text/Chapter 1.xhtml',
      'OEBPS/',
      'a/b/c.png',
      '..a',
      'a..',
    ]) {
      expect(isZipPath(name), name).toBe(true);
    }
  });

  it('refuses what would leave the zip or isn’t clean', () => {
    for (const name of [
      '',
      '/a',
      '../a',
      'a/../b',
      'a/./b',
      'a//b',
      'a\\b',
      'C:/a',
      'c:a',
      'a\u0000',
      'a\u001fb',
      'a\u007f',
      '.',
      '..',
    ]) {
      expect(isZipPath(name), JSON.stringify(name)).toBe(false);
    }
  });
});

describe('inZip', () => {
  const from = 'OEBPS/Text/chapter-1.xhtml';

  it('resolves an address from the file it’s in, with its fragment apart', () => {
    expect(inZip(from, '../Images/plate%201.jpg')).toEqual({
      path: 'OEBPS/Images/plate 1.jpg',
      fragment: '',
    });
    expect(inZip(from, 'chapter-2.xhtml#note%201')).toEqual({
      path: 'OEBPS/Text/chapter-2.xhtml',
      fragment: 'note 1',
    });
    expect(inZip(from, './chapter-2.xhtml?x=1')).toEqual({
      path: 'OEBPS/Text/chapter-2.xhtml',
      fragment: '',
    });
    expect(inZip(from, '#p4')).toEqual({ path: from, fragment: 'p4' });
    expect(inZip(from, '/OEBPS/nav.xhtml')).toEqual({ path: 'OEBPS/nav.xhtml', fragment: '' });
    expect(inZip('', 'OEBPS/content.opf')).toEqual({ path: 'OEBPS/content.opf', fragment: '' });
  });

  it('refuses what leaves the zip, any scheme, and what can’t be read', () => {
    for (const href of [
      '../../../outside.jpg',
      '../../..',
      'https://example.com/a.jpg',
      '//example.com/a.jpg',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'file:///etc/passwd',
      '%2e%2e/%2e%2e/%2e%2e/a',
      'a%5Cb.png',
      'bad%escape.png',
    ]) {
      expect(inZip(from, href), href).toBeNull();
    }
  });
});
