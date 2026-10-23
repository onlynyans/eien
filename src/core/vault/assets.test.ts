// A note's own folder of images: its name, the links to what's in it, the
// names images are kept under, and the links following a rename or a move.

import { describe, expect, it } from 'vitest';
import { resolveLinkPath } from '../paths';
import {
  assetLinkOf,
  assetsFolderOf,
  imageNameFor,
  isAssetsFolder,
  numberedName,
  relinkAssets,
} from './assets';
import type { VaultEntry } from './entries';
import { buildTree } from './tree';

describe('a note’s own folder', () => {
  it('is named for the note, beside it', () => {
    expect(assetsFolderOf('Chapter 3.md')).toBe('Chapter 3.assets');
    expect(assetsFolderOf('Fic/A Mended Scarf/Fire.md')).toBe('Fic/A Mended Scarf/Fire.assets');
  });

  it('is one only beside its note: with the note gone it’s a folder like any other', () => {
    const notes = new Set(['Fic/Chapter 3.md']);
    const isNote = (path: string) => notes.has(path);
    expect(isAssetsFolder('Fic/Chapter 3.assets', isNote)).toBe(true);
    expect(isAssetsFolder('Fic/Chapter 4.assets', isNote)).toBe(false);
    expect(isAssetsFolder('Chapter 3.assets', isNote)).toBe(false); // another folder's
    expect(isAssetsFolder('Fic/.assets', isNote)).toBe(false);
    expect(isAssetsFolder('Fic/Chapter 3', isNote)).toBe(false);
  });

  it('is left out of the tree, with all it holds', () => {
    const entry = (path: string, kind: VaultEntry['kind']): VaultEntry => ({
      path,
      kind,
      modified: 0,
      size: 0,
    });
    const tree = buildTree(
      [
        entry('Chapter 3.md', 'note'),
        entry('Chapter 3.assets', 'folder'),
        entry('Chapter 3.assets/image.png', 'file'),
        entry('Chapter 3.assets/stray.md', 'note'),
        entry('Chapter 3.assets/inner', 'folder'),
        entry('Orphan.assets', 'folder'),
      ],
      'V',
    );
    expect(tree.folders.map((folder) => folder.name)).toEqual(['Orphan.assets']);
    expect(tree.notes).toEqual(['Chapter 3.md']);
    expect(tree.noteCount).toBe(1);
  });
});

describe('the link to an image in it', () => {
  it('is relative to the note and percent-encoded, as a Markdown link must be', () => {
    expect(assetLinkOf('Fic/Chapter 3.md', 'image.png')).toBe('Chapter%203.assets/image.png');
    expect(assetLinkOf('Notes (old).md', 'a b#c.png')).toBe(
      'Notes%20%28old%29.assets/a%20b%23c.png',
    );
  });

  it('finds the image again, as the page reads links', () => {
    for (const note of ['Fic/Chapter 3.md', 'Café — notes (2).md', 'a/b/100% done!.md']) {
      const link = assetLinkOf(note, 'my image (1).png');
      const folder = note.slice(0, Math.max(0, note.lastIndexOf('/')));
      expect(resolveLinkPath(folder, link)).toBe(`${assetsFolderOf(note)}/my image (1).png`);
    }
  });
});

describe('the name an image is kept under', () => {
  it('is its own, its extension in lower case', () => {
    expect(imageNameFor('Scarf.PNG', 'image/png')).toBe('Scarf.png');
    expect(imageNameFor('cover.jpeg', '')).toBe('cover.jpeg');
    expect(imageNameFor('C:\\Users\\me\\map.webp', 'image/webp')).toBe('map.webp');
  });

  it('is named for its kind when it came with none (a pasted screenshot)', () => {
    expect(imageNameFor('', 'image/png')).toBe('image.png');
    expect(imageNameFor('blob', 'image/jpeg')).toBe('image.jpg');
  });

  it('is nothing for what a note can’t show', () => {
    expect(imageNameFor('notes.pdf', 'application/pdf')).toBeNull();
    expect(imageNameFor('', 'text/plain')).toBeNull();
    expect(imageNameFor('.png', 'application/octet-stream')).toBeNull();
  });

  it('is numbered when taken, the extension kept', () => {
    expect([1, 2, 3].map((n) => numberedName('image.png', n))).toEqual([
      'image.png',
      'image 2.png',
      'image 3.png',
    ]);
  });
});

describe('the links after a rename or a move', () => {
  it('point at the folder’s new name', () => {
    const text =
      'One ![](Chapter%203.assets/image.png) and ![map](Chapter%203.assets/a%20b.png "Map").';
    expect(relinkAssets(text, 'Fic/Chapter 3.md', 'Fic/Chapter Four.md')).toBe(
      'One ![](Chapter%20Four.assets/image.png) and ![map](Chapter%20Four.assets/a%20b.png "Map").',
    );
  });

  it('follow a reference definition, and a link written unencoded', () => {
    const text = '![a][1]\n\n[1]: Old.assets/x.png\n\n[b](./Old.assets/y.png#top)';
    expect(relinkAssets(text, 'Old.md', 'New.md')).toBe(
      '![a][1]\n\n[1]: New.assets/x.png\n\n[b](New.assets/y.png#top)',
    );
  });

  it('leave every other link as written', () => {
    const text =
      '![](cover.png) ![](Other.assets/x.png) ![](https://example.com/Old.assets/x.png) [w](Old.assetsy/z.png)';
    expect(relinkAssets(text, 'Old.md', 'New.md')).toBe(text);
  });

  it('change nothing when the note keeps its name in another folder', () => {
    const text = '![](Old.assets/x.png)';
    expect(relinkAssets(text, 'Old.md', 'Elsewhere/Old.md')).toBe(text);
  });
});
