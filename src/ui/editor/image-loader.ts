// Images in a note come from the vault, through the bridge, as blob URLs:
// the only kind the content security policy lets the page show (spec §4).

import { resolveLinkPath } from '../../core/paths';
import type { ImageLoader } from './widgets';

const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
};

export interface NoteImages {
  readonly load: ImageLoader;
  /** Let go of every URL made, when the note closes. */
  release(): void;
}

/** Images for a note in `folder`, read with `readBytes`. */
export function noteImages(
  folder: string,
  readBytes: (path: string) => Promise<Uint8Array | null>,
): NoteImages {
  const made = new Map<string, Promise<string | null>>();
  const load: ImageLoader = (src) => {
    const path = resolveLinkPath(folder, src);
    const type = path ? TYPES[path.slice(path.lastIndexOf('.') + 1).toLowerCase()] : undefined;
    if (!path || !type) return Promise.resolve(null);
    let url = made.get(path);
    if (!url) {
      url = readBytes(path)
        .then((bytes) =>
          bytes ? URL.createObjectURL(new Blob([bytes.slice().buffer], { type })) : null,
        )
        .catch(() => null);
      made.set(path, url);
    }
    return url;
  };
  return {
    load,
    release: () => {
      for (const url of made.values()) void url.then((u) => u && URL.revokeObjectURL(u));
      made.clear();
    },
  };
}
