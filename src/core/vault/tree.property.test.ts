// What holds for any vault (#40): FOLDERS never hides a folder with a note
// under it, nor an empty one, nor cuts a folder it lists off from the
// sidebar; a folder of notes and EPUBs is in both sections; and every
// folder is in one of them.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { VaultEntry } from './entries';
import { buildTree, type FolderNode, inFolders, onShelf } from './tree';

const NAMES = ['a', 'b', 'c'];

/** A vault's entries: notes, EPUBs, other files and folders, up to three deep. */
const entries = fc.array(
  fc
    .tuple(
      fc.array(fc.constantFrom(...NAMES), { minLength: 0, maxLength: 3 }),
      fc.constantFrom<VaultEntry['kind']>('note', 'epub', 'file', 'folder'),
      fc.nat(9),
    )
    .map(([folders, kind, n]): VaultEntry => {
      const name = kind === 'note' ? `n${n}.md` : kind === 'epub' ? `e${n}.epub` : `f${n}`;
      const path =
        kind === 'folder' && folders.length > 0 ? folders.join('/') : [...folders, name].join('/');
      return { path, kind, modified: 0, size: 0 };
    }),
  { maxLength: 30 },
);

const everyFolder = (node: FolderNode): FolderNode[] =>
  node.folders.flatMap((folder) => [folder, ...everyFolder(folder)]);

const holds = (node: FolderNode, has: (folder: FolderNode) => boolean): boolean =>
  has(node) || node.folders.some((folder) => holds(folder, has));

describe('FOLDERS and SHELF over any vault', () => {
  it('never hides a folder with a note under it, or an empty one', () => {
    fc.assert(
      fc.property(entries, (vault) => {
        for (const folder of everyFolder(buildTree(vault, 'Vault'))) {
          const empty =
            folder.notes.length === 0 && folder.epubs.length === 0 && folder.folders.length === 0;
          if (holds(folder, (node) => node.notes.length > 0) || empty) {
            expect(inFolders(folder)).toBe(true);
          }
        }
      }),
    );
  });

  it('hides only a folder whose contents, at any depth, are EPUBs alone', () => {
    fc.assert(
      fc.property(entries, (vault) => {
        for (const folder of everyFolder(buildTree(vault, 'Vault'))) {
          if (inFolders(folder)) continue;
          expect(holds(folder, (node) => node.notes.length > 0)).toBe(false);
          // Every folder under it holds something, and none of it a note: so EPUBs.
          for (const under of [folder, ...everyFolder(folder)]) {
            expect(under.notes).toEqual([]);
            expect(under.epubCount).toBeGreaterThan(0);
          }
        }
      }),
    );
  });

  it('puts a folder of notes and EPUBs in both, and every folder in one', () => {
    fc.assert(
      fc.property(entries, (vault) => {
        for (const folder of everyFolder(buildTree(vault, 'Vault'))) {
          if (folder.noteCount > 0 && folder.epubCount > 0) {
            expect([inFolders(folder), onShelf(folder)]).toEqual([true, true]);
          }
          expect(inFolders(folder) || onShelf(folder)).toBe(true);
        }
      }),
    );
  });

  it('never cuts a listed folder off: the folder it is in is listed too', () => {
    fc.assert(
      fc.property(entries, (vault) => {
        const walk = (node: FolderNode) => {
          for (const child of node.folders) {
            if (inFolders(child)) expect(inFolders(node)).toBe(true);
            if (onShelf(child)) expect(onShelf(node)).toBe(true);
            walk(child);
          }
        };
        for (const top of buildTree(vault, 'Vault').folders) walk(top);
      }),
    );
  });
});
