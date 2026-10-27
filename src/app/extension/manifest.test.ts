import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STORY_MATCHES } from '../../core/extension';
import { extensionManifest, ICON_SIZES } from './manifest';

const manifest = extensionManifest('1.2.3');

describe('the extension’s manifest', () => {
  it('is Manifest V3, at the app’s version', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe('1.2.3');
  });

  it('asks for storage alone, and no host beyond the story sites', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest).not.toHaveProperty('host_permissions');
    expect(manifest).not.toHaveProperty('optional_permissions');
    expect(manifest).not.toHaveProperty('background');
    for (const script of manifest.content_scripts) expect(script.matches).toEqual(STORY_MATCHES);
    for (const each of manifest.web_accessible_resources) {
      expect(each.resources).toEqual(['story.html']);
      expect(each.matches).toEqual(STORY_MATCHES);
    }
    for (const match of STORY_MATCHES) expect(match).toMatch(/^https:\/\/[a-z.]+\/\*$/u);
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
