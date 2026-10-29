import { describe, expect, it } from 'vitest';
import { parseHtml } from '../html';
import { contentsOf } from './contents';
import type { Package } from './package';

const PKG: Package = {
  path: 'OEBPS/content.opf',
  title: 'T',
  author: '',
  language: '',
  manifest: new Map(),
  spine: [
    { path: 'OEBPS/a.xhtml', linear: true },
    { path: 'OEBPS/b.xhtml', linear: true },
    { path: 'OEBPS/notes.xhtml', linear: false },
  ],
  nav: null,
  ncx: 'OEBPS/toc.ncx',
};

const ncx = (map: string) => ({ nav: null, ncx: parseHtml(`<ncx><navMap>${map}</navMap></ncx>`) });

describe('contentsOf', () => {
  it('takes a navPoint’s own label, never its first child’s', () => {
    const rows = contentsOf(
      PKG,
      ncx(
        '<navPoint><content src="a.xhtml"/><navPoint><navLabel><text>Inner</text></navLabel><content src="b.xhtml"/></navPoint></navPoint>',
      ),
    );
    expect(rows.map((row) => [row.title, row.depth])).toEqual([['Inner', 1]]);
  });

  it('leaves out a row whose file isn’t in the spine, or isn’t in the zip', () => {
    const rows = contentsOf(
      PKG,
      ncx(
        '<navPoint><navLabel><text>A</text></navLabel><content src="a.xhtml#start"/></navPoint><navPoint><navLabel><text>Gone</text></navLabel><content src="gone.xhtml"/></navPoint><navPoint><navLabel><text>Out</text></navLabel><content src="../../out.xhtml"/></navPoint>',
      ),
    );
    expect(rows).toEqual([
      { title: 'A', path: 'OEBPS/a.xhtml', fragment: 'start', depth: 0, spine: 0 },
    ]);
  });

  it('with no contents, lists each file the spine reads in order', () => {
    expect(
      contentsOf({ ...PKG, ncx: null }, { nav: null, ncx: null }).map((row) => row.title),
    ).toEqual(['Section 1', 'Section 2']);
  });
});
