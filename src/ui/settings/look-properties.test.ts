// The settings set as custom properties: the machine voice's face and sizes,
// the weight of names and its rule, and the Running head's ground. Their
// defaults are tokens.css's (tests/faces-tokens.test.ts).

import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../core/config';
import { chosenTitleWeight, lookProperties } from './look-properties';

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

describe('the machine voice’s face', () => {
  it('names a face’s family and brings its own sizes', () => {
    const set = lookProperties({ ...DEFAULT_SETTINGS, 'appearance.machineFace': 'newsreader' });
    expect(set).toMatchObject({
      '--eien-face-mono': 'var(--eien-family-newsreader)',
      '--eien-size-meta': '12.5px',
      '--eien-size-label': '11.5px',
      '--eien-size-source': '16.5px',
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
