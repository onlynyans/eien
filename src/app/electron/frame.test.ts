import { describe, expect, it } from 'vitest';
import { controlsPaint, frameOptions, lightsIn } from './frame';

describe('the window’s frame (spec §4: no title bar)', () => {
  it('hides the title bar, keeping the system’s controls over the bands', () => {
    expect(frameOptions('darwin', 1)).toMatchObject({
      titleBarStyle: 'hiddenInset',
      titleBarOverlay: true,
    });
    for (const platform of ['win32', 'linux'] as const) {
      expect(frameOptions(platform, 1)).toEqual({
        titleBarStyle: 'hidden',
        titleBarOverlay: { height: 56 },
      });
    }
    expect(frameOptions('linux', 1.5)).toMatchObject({ titleBarOverlay: { height: 84 } });
  });

  it('keeps the traffic lights in the middle of the band, however zoomed', () => {
    expect(lightsIn(56)).toEqual({ x: 20, y: 20 });
    expect(lightsIn(112)).toEqual({ x: 20, y: 48 });
    expect(lightsIn(10)).toEqual({ x: 20, y: 0 });
  });
});

describe('what the window may ask the controls to look like', () => {
  const good = { band: 'rgb(243, 240, 235)', ink: 'rgba(81, 71, 60, 0.9)', height: 56 };

  it('takes computed colours and a band’s height', () => {
    expect(controlsPaint(good)).toEqual(good);
  });

  it('refuses anything else', () => {
    for (const bad of [
      null,
      'rgb(0,0,0)',
      { ...good, band: 'url(https://example.com/x)' },
      { ...good, ink: 'red; height: 9999' },
      { ...good, band: `rgb(${'1'.repeat(5000)}, 0, 0)` },
      { ...good, height: 0 },
      { ...good, height: 10_000 },
      { ...good, height: Number.NaN },
      { ...good, height: '56' },
    ]) {
      expect(() => controlsPaint(bad)).toThrow(TypeError);
    }
  });
});
