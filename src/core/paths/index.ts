export { resolveLinkPath } from './link-path';
export {
  isHiddenName,
  isValidName,
  isWatchedPath,
  type NameProblem,
  nameKey,
  nameProblems,
  safeName,
  VAULT_CONFIG,
  VAULT_PINS,
} from './names';
export {
  conflictName,
  freeName,
  freeNoteName,
  movedPath,
  NOTE_EXTENSION,
  type Renamed,
  recoveredName,
  renamedPath,
  stampOf,
  titleOf,
} from './sibling-names';
export { baseName, joinPath, parentOf, VaultPathError, vaultPath } from './vault-path';
