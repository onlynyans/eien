// Images in a note come from the vault, through the bridge, as blob URLs:
// the only kind the content security policy lets the page show (spec §4).

import { resolveLinkPath } from '../../core/paths';
import { imageTypeOf } from '../../core/vault';
import type { ImageLoader } from './widgets';

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
    const type = path ? imageTypeOf(path.slice(path.lastIndexOf('/') + 1)) : null;
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
