// What a browser checks of the build before it loads the extension at all.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('the content script is plain ASCII, as Chrome loads only strict UTF-8 (no noncharacters)', () => {
  const script = readFileSync(resolve(import.meta.dirname, '../../out/extension/content.js'));
  expect(script.findIndex((byte) => byte > 0x7f)).toBe(-1);
});
