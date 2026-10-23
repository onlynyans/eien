// The one new file the window may write as bytes: an image a note shows (one
// dropped or pasted into it, spec §4), no bigger than a note shows. Anything
// else the window writes is text, through the version check. Checked where
// the window's asking arrives: the desktop's main process, the phone's vault.

import { baseName } from '../core/paths';
import { imageTypeOf, MAX_IMAGE_BYTES } from '../core/vault';

/** `path` and `bytes` as `writeNew` takes them, once they're an image's; throws otherwise. */
export function imageWrite(path: string, bytes: unknown): [string, Uint8Array] {
  if (typeof path !== 'string') throw new TypeError('path must be text.');
  if (!(bytes instanceof Uint8Array)) throw new TypeError('bytes must be a Uint8Array.');
  if (!imageTypeOf(baseName(path))) throw new TypeError('Only an image can be written as bytes.');
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new RangeError('The image is too big.');
  return [path, bytes];
}
