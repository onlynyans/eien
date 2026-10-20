export {
  type EntryKind,
  isNoteName,
  isSyncConflictName,
  kindOf,
  syncConflictOf,
  type VaultEntry,
} from './entries';
export {
  FOLDER_SETTINGS_NAME,
  type FolderSettings,
  NO_FOLDER_SETTINGS,
  orderNames,
  parseFolderSettings,
} from './folder-settings';
export { buildTree, byName, type FolderNode } from './tree';
