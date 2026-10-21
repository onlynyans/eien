// Eien's name and id decide where an installed copy keeps this device's
// settings, and which copy an update replaces (electron-builder.ts). A rename
// would leave every writer's settings behind, so this test fails on one.

import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import config, { IDENTITY } from '../electron-builder';

const ROOT = resolve(import.meta.dirname, '..');
const json = (file: string) => JSON.parse(readFileSync(join(ROOT, file), 'utf8'));

describe("Eien's identity", () => {
  it('is the one every installed copy has', () => {
    expect(IDENTITY).toEqual({ productName: 'Eien', appId: 'io.github.onlynyans.eien' });
  });

  it('names the installers', () => {
    expect(config.productName).toBe(IDENTITY.productName);
    expect(config.appId).toBe(IDENTITY.appId);
  });

  it('names the data folder, in development too', () => {
    // Electron names app.getPath('userData') after package.json's productName.
    expect(json('package.json').productName).toBe(IDENTITY.productName);
  });

  it('is the phone app’s id', () => {
    expect(json('capacitor.config.json').appId).toBe(IDENTITY.appId);
  });

  it('is never changed while the app runs', () => {
    // Only the tests' own data folder (EIEN_USER_DATA) may move the settings.
    const dir = join(ROOT, 'src/app/electron');
    const sources = readdirSync(dir)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .map((name) => readFileSync(join(dir, name), 'utf8'))
      .join('\n');
    expect(sources).not.toMatch(/\bsetName\(|\bapp\.name\s*=[^=]/);
    expect(sources.match(/setPath\('userData'/g)).toHaveLength(1);
    expect(sources).toContain("if (userData) app.setPath('userData', userData);");
  });
});
