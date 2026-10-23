// The faces and weights against tokens.css (#24, #25): every face listed in
// core/config/faces.ts has its family there, every text face its sizes, and
// the defaults the settings leave to it are the ones the settings would set.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FACES, TEXT_FACES } from '../src/core/config';

const TOKENS = readFileSync(resolve(import.meta.dirname, '../src/ui/theme/tokens.css'), 'utf8');
const token = (name: string) => TOKENS.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();

describe('the faces in tokens.css', () => {
  it('has a family for every face, and a [data-face] block for every text face', () => {
    for (const face of FACES) expect(token(`--eien-family-${face.id}`), face.id).toBeTruthy();
    for (const face of TEXT_FACES) {
      expect(TOKENS, face.id).toContain(
        `[data-face="${face.id}"] {\n  --eien-face-text: var(--eien-family-${face.id});`,
      );
    }
  });

  it('holds Plex Mono as the interface and Source fonts, at the sizes FACES gives it', () => {
    const mono = FACES[0];
    expect(token('--eien-face-mono')).toBe(`var(--eien-family-${mono.id})`);
    expect(token('--eien-face-source')).toBe(`var(--eien-family-${mono.id})`);
    expect(token('--eien-size-meta')).toBe(`${mono.machine.meta}px`);
    expect(token('--eien-size-label')).toBe(`${mono.machine.label}px`);
    expect(token('--eien-size-source')).toBe(`${mono.machine.source}px`);
  });

  it('holds the weights’ defaults: 400, and 500 for a chosen list title', () => {
    expect(token('--eien-weight-tree')).toBe('400');
    expect(token('--eien-weight-list')).toBe('400');
    expect(token('--eien-weight-list-chosen')).toBe('500'); // chosenTitleWeight(400)
  });
});
