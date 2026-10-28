// package.json's version is the only one (scripts/version.mjs). Every build
// that names a version must name the same, or a phone app and the desktop's
// installer of one release would say different things.

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildNumber, GRADLE, gradleWith, XCODE, xcodeWith } from '../scripts/version.mjs';
import { extensionManifest } from '../src/app/extension/manifest';

const ROOT = resolve(import.meta.dirname, '..');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8');
const { version } = JSON.parse(read('package.json')) as { version: string };

describe('the version', () => {
  it('is package.json’s on Android', () => {
    const gradle = read(GRADLE);
    expect(gradle).toContain(`versionName "${version}"`);
    expect(gradle).toContain(`versionCode ${buildNumber(version)}\n`);
  });

  it('is package.json’s on iOS, in every build configuration', () => {
    const pbxproj = read(XCODE);
    const marketing = [...pbxproj.matchAll(/MARKETING_VERSION = ([^;]*);/g)].map((m) => m[1]);
    const builds = [...pbxproj.matchAll(/CURRENT_PROJECT_VERSION = ([^;]*);/g)].map((m) => m[1]);
    expect(marketing.length).toBeGreaterThan(0);
    expect(new Set(marketing)).toEqual(new Set([version]));
    expect(builds).toHaveLength(marketing.length);
    expect(new Set(builds)).toEqual(new Set([String(buildNumber(version))]));
  });

  it('is what scripts/version.mjs writes, so a build leaves the projects as committed', () => {
    expect(gradleWith(read(GRADLE), version)).toBe(read(GRADLE));
    expect(xcodeWith(read(XCODE), version)).toBe(read(XCODE));
  });

  it('is written into the phone projects by every phone build, and by npm version', () => {
    const { scripts } = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
    for (const name of ['android', 'ios', 'version']) {
      expect(scripts[name], name).toMatch(/^(?:.* && )?node scripts\/version\.mjs( && |$)/);
    }
  });

  it('is the extension’s', () => {
    // vite.extension.config.ts hands package.json's version to the manifest.
    expect(read('vite.extension.config.ts')).toMatch(/extensionManifest\(version\)/);
    expect(extensionManifest(version).version).toBe(version);
  });

  it('is the one the release workflow holds the tag to', () => {
    expect(read('.github/workflows/release.yml')).toContain(
      `version="v$(node -p "require('./package.json').version")"`,
    );
  });
});

describe('the build number', () => {
  it('is major×10000 + minor×100 + patch', () => {
    expect(buildNumber('0.1.0')).toBe(100);
    expect(buildNumber('0.5.0')).toBe(500);
    expect(buildNumber('0.4.12')).toBe(412);
    expect(buildNumber('1.0.0')).toBe(10000);
    expect(buildNumber('2.13.7')).toBe(21307);
  });

  it('rises with every version', () => {
    const order = [
      '0.0.1',
      '0.1.0',
      '0.1.1',
      '0.2.0',
      '0.99.99',
      '1.0.0',
      '1.0.1',
      '1.1.0',
      '10.0.0',
    ];
    const numbers: number[] = order.map(buildNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('refuses what it can’t number', () => {
    for (const bad of ['1.0', 'v1.0.0', '1.0.0-beta.1', '0.100.0', '0.1.100', '0.0.0', '']) {
      expect(() => buildNumber(bad), bad).toThrow();
    }
  });
});

describe('writing the version', () => {
  it('sets Android’s name and code', () => {
    const gradle = 'defaultConfig {\n        versionCode 1\n        versionName "1.0"\n    }\n';
    expect(gradleWith(gradle, '0.5.0')).toBe(
      'defaultConfig {\n        versionCode 500\n        versionName "0.5.0"\n    }\n',
    );
  });

  it('sets every iOS build configuration', () => {
    const one = 'CURRENT_PROJECT_VERSION = 1;\nMARKETING_VERSION = 1.0;\n';
    expect(xcodeWith(one + one, '0.5.0')).toBe(
      'CURRENT_PROJECT_VERSION = 500;\nMARKETING_VERSION = 0.5.0;\n'.repeat(2),
    );
  });

  it('fails on a project that no longer names a version, rather than leave it stale', () => {
    expect(() => gradleWith('defaultConfig {}', '0.5.0')).toThrow();
    expect(() => xcodeWith('MARKETING_VERSION = 1.0;', '0.5.0')).toThrow();
  });
});
