// One list of faces for both face settings (#24): each face listed once,
// the mono the machine voice's default and never a text face.

import { describe, expect, it } from 'vitest';
import { FACES, faceOf, MACHINE_FACES, TEXT_FACES } from './faces';
import { settingOf } from './settings';

const choicesOf = (key: string) => {
  const setting = settingOf(key);
  if (setting?.type !== 'choice') throw new Error(`${key} isn’t a choice`);
  return setting;
};

describe('FACES', () => {
  it('lists each face once, the mono first and alone', () => {
    const ids = FACES.map((face) => face.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(FACES[0]).toMatchObject({ id: 'plex-mono', mono: true });
    expect(FACES.filter((face) => 'mono' in face)).toHaveLength(1);
  });

  it('feeds both face settings: the text face every face but the mono, the machine voice all', () => {
    const face = choicesOf('appearance.face');
    const machine = choicesOf('appearance.machineFace');
    expect(Object.entries(face.choices)).toEqual(TEXT_FACES.map((each) => [each.id, each.name]));
    expect(Object.entries(machine.choices)).toEqual(
      MACHINE_FACES.map((each) => [each.id, each.name]),
    );
    expect(Object.keys(face.choices)).toHaveLength(8);
    expect(face.default).toBe('newsreader');
    expect(machine.default).toBe('plex-mono');
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
