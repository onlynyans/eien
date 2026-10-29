// The settings set as custom properties: the interface font's face and sizes,
// the Source font's, the weight of names and its rule, and the Running head's ground. Their
// defaults are tokens.css's (tests/faces-tokens.test.ts).

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, withDefaults } from '../../core/config';
import { chosenTitleWeight, leafLook, lookProperties } from './look-properties';

describe('the weights’ rule', () => {
  it('makes a chosen list title a step heavier, never past 700', () => {
    expect([400, 500, 600, 700].map(chosenTitleWeight)).toEqual([500, 600, 700, 700]);
  });

  it('sets the weights, and leaves the sidebar’s chosen name at its own', () => {
    const set = lookProperties({
      ...DEFAULT_SETTINGS,
      'appearance.nameWeight': 600,
      'appearance.titleWeight': 700,
    });
    expect(set).toMatchObject({
      '--eien-weight-tree': '600',
      '--eien-weight-list': '700',
      '--eien-weight-list-chosen': '700',
    });
    expect(Object.keys(set).filter((name) => name.includes('tree'))).toEqual([
      '--eien-weight-tree',
    ]);
  });

  it('sets nothing at the defaults: they’re tokens.css’s own', () => {
    expect(Object.values(lookProperties(DEFAULT_SETTINGS)).every((v) => v === null)).toBe(true);
  });
});

describe('the interface font', () => {
  it('names a face’s family and brings its own sizes, leaving the Source view alone', () => {
    const set = lookProperties({ ...DEFAULT_SETTINGS, 'appearance.interfaceFace': 'newsreader' });
    expect(set).toMatchObject({
      '--eien-face-mono': 'var(--eien-family-newsreader)',
      '--eien-size-meta': '12.5px',
      '--eien-size-label': '11.5px',
      '--eien-face-source': null,
      '--eien-size-source': null,
    });
  });

  it('sets another mono too: only Plex Mono, the default, is tokens.css’s own', () => {
    const set = lookProperties({ ...DEFAULT_SETTINGS, 'appearance.interfaceFace': 'iosevka' });
    expect(set).toMatchObject({
      '--eien-face-mono': 'var(--eien-family-iosevka)',
      '--eien-size-meta': '12px',
      '--eien-size-label': '11px',
    });
  });
});

describe('the Source font', () => {
  it('names a face’s family and its source size, leaving the interface alone', () => {
    const set = lookProperties({ ...DEFAULT_SETTINGS, 'appearance.sourceFace': 'comic-mono' });
    expect(set).toMatchObject({
      '--eien-face-source': 'var(--eien-family-comic-mono)',
      '--eien-size-source': '14px',
      '--eien-face-mono': null,
      '--eien-size-meta': null,
    });
  });
});

describe('the Running head’s ground', () => {
  it('is one of the theme’s surfaces, and the desk is tokens.css’s own', () => {
    expect(
      lookProperties({ ...DEFAULT_SETTINGS, 'appearance.runheadGround': 'paper' })[
        '--runhead-ground'
      ],
    ).toBe('var(--eien-paper)');
    expect(lookProperties(DEFAULT_SETTINGS)['--runhead-ground']).toBeNull();
  });
});

describe('line spacing and page width (#49)', () => {
  it('step the face’s own leading and measure, and set nothing As set', () => {
    const at = (leading: string, width: string) =>
      lookProperties({
        ...DEFAULT_SETTINGS,
        'appearance.leading': leading as never,
        'page.width': width as never,
      });
    expect(at('tight', 'narrow')).toMatchObject({ '--look-lead': '0.9', '--look-width': '0.84' });
    expect(at('loose', 'wide')).toMatchObject({ '--look-lead': '1.12', '--look-width': '1.18' });
    expect(at('set', 'set')).toMatchObject({ '--look-lead': null, '--look-width': null });
  });
});

describe('a book’s page’s own look (#40)', () => {
  it('is the shelf’s settings, its face and frame always named, the notes’ aside', () => {
    const values = withDefaults({
      'appearance.face': 'hanken',
      'appearance.leading': 'tight',
      'epub.appearance.textSize': 120,
      'epub.appearance.leading': 'loose',
      'epub.page.width': 'narrow',
      'epub.appearance.frame': 'full',
    });
    expect(leafLook(values)).toEqual({
      face: 'newsreader',
      frame: 'full',
      properties: { '--eien-text-scale': '1.2', '--look-lead': '1.12', '--look-width': '0.84' },
    });
    expect(leafLook(withDefaults({})).frame).toBe('sheet');
  });
});
