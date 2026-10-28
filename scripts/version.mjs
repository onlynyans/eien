// package.json's version is the only one. `npm run android`, `npm run ios` and
// `npm version` run this, writing it into the phone projects: Android's
// versionName and iOS's MARKETING_VERSION, and the build number each store
// needs to rise with every release (tests/version.test.ts holds them together).

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const GRADLE = 'android/app/build.gradle';
export const XCODE = 'ios/App/App.xcodeproj/project.pbxproj';

/**
 * The build number of `version` (major.minor.patch), as Android's versionCode and iOS's
 * CURRENT_PROJECT_VERSION: major×10000 + minor×100 + patch, so it rises with the version.
 * @param {string} version
 */
export function buildNumber(version) {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!parts) throw new Error(`"${version}" isn't major.minor.patch.`);
  const [major, minor, patch] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  // Past 99 a minor or patch would run into the next part's digits.
  if (minor > 99 || patch > 99) throw new Error(`${version}: minor and patch stop at 99.`);
  const number = major * 10000 + minor * 100 + patch;
  // Android refuses a versionCode of 0.
  if (number === 0) throw new Error('0.0.0 has no build number.');
  return number;
}

/**
 * build.gradle with `version` as its versionName and versionCode.
 * @param {string} gradle
 * @param {string} version
 */
export function gradleWith(gradle, version) {
  return replaced(
    replaced(gradle, /versionCode \d+/, `versionCode ${buildNumber(version)}`),
    /versionName "[^"]*"/,
    `versionName "${version}"`,
  );
}

/**
 * project.pbxproj with `version` in every build configuration that names one.
 * @param {string} pbxproj
 * @param {string} version
 */
export function xcodeWith(pbxproj, version) {
  return replaced(
    replaced(pbxproj, /MARKETING_VERSION = [^;]*;/g, `MARKETING_VERSION = ${version};`),
    /CURRENT_PROJECT_VERSION = [^;]*;/g,
    `CURRENT_PROJECT_VERSION = ${buildNumber(version)};`,
  );
}

/**
 * @param {string} text
 * @param {RegExp} pattern
 * @param {string} by
 */
function replaced(text, pattern, by) {
  // A project regenerated without the line would otherwise keep a stale version quietly.
  if (!pattern.test(text)) throw new Error(`Nothing matches ${pattern}.`);
  pattern.lastIndex = 0;
  return text.replace(pattern, by);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), '../..');
  const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  /** @type {[string, (text: string, version: string) => string][]} */
  const projects = [
    [GRADLE, gradleWith],
    [XCODE, xcodeWith],
  ];
  for (const [file, rewrite] of projects) {
    const path = resolve(root, file);
    const before = readFileSync(path, 'utf8');
    const after = rewrite(before, version);
    if (after !== before) writeFileSync(path, after);
  }
  console.log(`Android and iOS: ${version} (build ${buildNumber(version)})`);
}
