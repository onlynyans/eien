import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { READER_MATCHES } from '../../core/reader';
import { ICON_SIZES, readerManifest } from './manifest';

const manifest = readerManifest('1.2.3');

describe('the reader’s manifest', () => {
  it('is Manifest V3, at the app’s version', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe('1.2.3');
  });

  it('asks for storage alone, and no host beyond the story sites', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest).not.toHaveProperty('host_permissions');
    expect(manifest).not.toHaveProperty('optional_permissions');
    expect(manifest).not.toHaveProperty('background');
    for (const script of manifest.content_scripts) expect(script.matches).toEqual(READER_MATCHES);
    for (const each of manifest.web_accessible_resources) {
      expect(each.resources).toEqual(['reader.html']);
      expect(each.matches).toEqual(READER_MATCHES);
    }
    for (const match of READER_MATCHES) expect(match).toMatch(/^https:\/\/[a-z.]+\/\*$/u);
  });

  it('names icons the seal has, at each size', () => {
    const linux = resolve(import.meta.dirname, '../../../build/icons/linux');
    for (const size of ICON_SIZES) {
      expect(
        readFileSync(resolve(linux, `${size}x${size}.png`))
          .subarray(1, 4)
          .toString(),
      ).toBe('PNG');
    }
  });
});
