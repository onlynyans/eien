// The images a book's exports carry (spec §8), read through the vault: each
// file once, however many notes show it; PNG, JPEG and GIF by their own
// headers; within the most one export holds. One from the web is never
// fetched; one that isn't there, of another kind or past the most is left as
// its description, and counted, so the news can say so.

import { imageAddresses } from '../../core/ao3';
import { type ExportImage, imageInfo, MAX_EXPORT_IMAGE_BYTES } from '../../core/export';
import { parentOf, resolveLinkPath } from '../../core/paths';
import { frontMatterEnd, toEditor } from '../../core/text';

/** A web address, mailto:, data:…: never read. */
const ELSEWHERE = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;

export class ExportImages {
  readonly #readBytes: (path: string) => Promise<Uint8Array | null>;
  readonly #read = new Map<string, Promise<ExportImage | null>>();
  readonly #left = new Set<string>();
  #bytes = 0;

  constructor(readBytes: (path: string) => Promise<Uint8Array | null>) {
    this.#readBytes = readBytes;
  }

  /** How many images were left as their descriptions. */
  get left(): number {
    return this.#left.size;
  }

  /** The images the note at `path`, holding `markdown`, shows that the export carries, by address. */
  async of(path: string, markdown: string): Promise<Map<string, ExportImage>> {
    const text = toEditor(markdown);
    const carried = new Map<string, ExportImage>();
    for (const address of imageAddresses(text.slice(frontMatterEnd(text)))) {
      if (ELSEWHERE.test(address)) continue;
      const at = resolveLinkPath(parentOf(path), address);
      const image = at === null ? null : await this.#image(at);
      if (image) carried.set(address, image);
      else this.#left.add(at ?? `${path}#${address}`);
    }
    return carried;
  }

  #image(path: string): Promise<ExportImage | null> {
    let reading = this.#read.get(path);
    if (!reading) {
      reading = this.#readBytes(path)
        .catch(() => null)
        .then((bytes) => {
          const info = bytes ? imageInfo(bytes) : null;
          if (!bytes || !info || this.#bytes + bytes.length > MAX_EXPORT_IMAGE_BYTES) return null;
          this.#bytes += bytes.length;
          return { key: path, bytes, info };
        });
      this.#read.set(path, reading);
    }
    return reading;
  }
}

/** The news's words for images left as their descriptions. */
export const leftImages = (n: number): string =>
  n === 0
    ? ''
    : ` ${n === 1 ? '1 image went' : `${n} images went`} as ${n === 1 ? 'its description' : 'their descriptions'} (not there, too big, or not PNG, JPEG or GIF).`;
