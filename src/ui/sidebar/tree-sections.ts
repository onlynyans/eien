// The sidebar's sections, in order (#40): LIBRARY, FOLDERS, SHELF, TAGS.
// SHELF shows only once the vault holds a book; each folds per device.

import type { TagNode } from '../../core/tags';
import type { FolderNode } from '../../core/vault';
import type { Folds } from './folds';
import { foldingSection } from './sections';
import { type ShelfActions, type ShelfModel, shelfRows } from './shelf-rows';
import type { TreeRows } from './tree';

export interface TreeSectionsOf {
  readonly rows: TreeRows;
  readonly folds: Folds;
  readonly tree: FolderNode;
  readonly tags: readonly TagNode[];
  /** A folder's name as a field, while it's renamed in place. */
  edit(folder: FolderNode, depth: number): HTMLElement | null;
  /** The quiet + beside FOLDERS and TAGS. */
  readonly addFolder: HTMLElement;
  readonly addTag: HTMLElement;
  /** A tag being named in place, at the end of TAGS. */
  readonly madeTag: readonly HTMLElement[];
  readonly shelf: ShelfModel;
  readonly actions: ShelfActions;
}

export const treeSections = (of: TreeSectionsOf): HTMLElement[] => [
  ...foldingSection('library', 'Library', of.rows.library(), of.folds),
  ...foldingSection(
    'folders',
    'Folders',
    of.rows.folders(of.tree, 0, of.edit),
    of.folds,
    of.addFolder,
  ),
  ...foldingSection('shelf', 'Shelf', shelfRows(of.shelf, of.actions), of.folds),
  ...foldingSection(
    'tags',
    'Tags',
    [...of.rows.tags(of.tags, 0), ...of.madeTag],
    of.folds,
    of.addTag,
  ),
];
