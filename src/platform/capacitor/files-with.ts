// For tests: a FilesPort with some of its calls replaced, to pick the moment
// something happens (a disk that fills, a phone that dies, Syncthing
// bringing a file in) between the storage's own calls.

import type { FilesPort } from './files';

export const filesWith = (files: FilesPort, over: Partial<FilesPort>): FilesPort => ({
  readText: (path) => files.readText(path),
  readBytes: (path) => files.readBytes(path),
  writeText: (path, text) => files.writeText(path, text),
  writeBytes: (path, bytes) => files.writeBytes(path, bytes),
  stat: (path) => files.stat(path),
  list: (folder) => files.list(folder),
  rename: (from, to) => files.rename(from, to),
  ...(files.replace && { replace: files.replace.bind(files) }),
  renameNew: (from, to) => files.renameNew(from, to),
  makeFolder: (path) => files.makeFolder(path),
  remove: (path) => files.remove(path),
  ...over,
});
