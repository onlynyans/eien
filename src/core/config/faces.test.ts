// One list of faces for the three face settings (#24): each face listed once,
// Plex Mono the interface's and the Source view's default, a mono never a text face.

import { describe, expect, it } from 'vitest';
import { FACES, faceOf, INTERFACE_FACES, TEXT_FACES } from './faces';
import { settingOf } from './settings';

const choicesOf = (key: string) => {
  const setting = settingOf(key);
  if (setting?.type !== 'choice') throw new Error(`${key} isn’t a choice`);
  return setting;
};

describe('FACES', () => {
  it('lists each face once, the monos first, Plex Mono first of all', () => {
    const ids = FACES.map((face) => face.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FACES[0]).toMatchObject({ id: 'plex-mono', mono: true });
    const monos = FACES.filter((face) => 'mono' in face);
    expect(FACES.slice(0, monos.length)).toEqual(monos);
    expect(monos.length).toBeGreaterThanOrEqual(8);
    expect(monos.length).toBeLessThanOrEqual(12);
  });

  it('feeds the face settings: the text face every face but the monos, the interface and Source fonts all', () => {
    const face = choicesOf('appearance.face');
    expect(Object.entries(face.choices)).toEqual(TEXT_FACES.map((each) => [each.id, each.name]));
    expect(Object.keys(face.choices)).toHaveLength(8);
    expect(face.default).toBe('newsreader');
    for (const key of ['appearance.interfaceFace', 'appearance.sourceFace']) {
      const setting = choicesOf(key);
      expect(Object.entries(setting.choices), key).toEqual(
        INTERFACE_FACES.map((each) => [each.id, each.name]),
      );
      expect(setting.default, key).toBe('plex-mono');
    }
  });

  it('gives every face its own machine sizes, at a size the eye can read', () => {
    for (const face of FACES) {
      const { meta, label, source } = face.machine;
      expect(label, face.id).toBeLessThan(meta);
      expect(meta, face.id).toBeLessThan(source);
      expect(label, face.id).toBeGreaterThanOrEqual(10);
    }
  });

  it('finds a face by its id, and nothing for one not listed', () => {
    expect(faceOf('literata')?.name).toBe('Literata');
    expect(faceOf('comic-sans')).toBeUndefined();
  });
});
