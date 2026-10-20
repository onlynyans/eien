import { describe, expect, it } from 'vitest';
import {
  checkSetting,
  DEFAULT_SETTINGS,
  readSettings,
  SETTING_GROUPS,
  SETTINGS,
  settingOf,
  stepped,
  valueProblem,
  withDefaults,
  withSetting,
} from './index';

describe('the schema', () => {
  it('names each setting once, as "section.name", in a known section', () => {
    const keys = SETTINGS.map((setting) => setting.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const setting of SETTINGS) {
      expect(setting.key).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      expect(SETTING_GROUPS).toContain(setting.group);
      expect(setting.label).not.toBe('');
      expect(setting.description).not.toBe('');
    }
  });

  it('gives every setting a default it would accept', () => {
    for (const setting of SETTINGS) expect(valueProblem(setting, setting.default)).toBeNull();
  });

  it('offers at least two choices, and number ranges that hold whole steps', () => {
    for (const setting of SETTINGS) {
      if (setting.type === 'choice') expect(Object.keys(setting.choices).length).toBeGreaterThan(1);
      else expect(Number.isInteger((setting.max - setting.min) / setting.step)).toBe(true);
    }
  });

  it('has the eight text faces, Newsreader first and the default', () => {
    const face = settingOf('appearance.face');
    expect(face?.type === 'choice' && Object.keys(face.choices)).toEqual([
      'newsreader',
      'literata',
      'plex-sans',
      'source-sans',
      'atkinson',
      'schibsted',
      'hanken',
      'instrument',
    ]);
    expect(DEFAULT_SETTINGS['appearance.face']).toBe('newsreader');
  });
});

describe('valueProblem', () => {
  const palette = settingOf('appearance.palette');
  const zoom = settingOf('page.zoom');
  if (!palette || !zoom) throw new Error('missing settings');

  it('accepts a listed choice and nothing else', () => {
    expect(valueProblem(palette, 'otaku')).toBeNull();
    for (const bad of [
      'Otaku',
      '',
      'toString',
      '__proto__',
      'constructor',
      1,
      null,
      undefined,
      ['otaku'],
    ]) {
      expect(valueProblem(palette, bad)).toMatch(/must be one of washi, otaku/);
    }
  });

  it('accepts a number on the steps within the range', () => {
    for (const good of [50, 60, 100, 190, 200]) expect(valueProblem(zoom, good)).toBeNull();
    for (const bad of [
      40,
      210,
      95,
      100.5,
      -100,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      '100',
      null,
    ]) {
      expect(valueProblem(zoom, bad)).not.toBeNull();
    }
  });
});

describe('stepped', () => {
  it('moves by whole steps and stops at the ends', () => {
    const zoom = settingOf('page.zoom');
    if (zoom?.type !== 'number') throw new Error('zoom is a number');
    expect(stepped(zoom, 100, 1)).toBe(110);
    expect(stepped(zoom, 100, -1)).toBe(90);
    expect(stepped(zoom, 200, 1)).toBe(200);
    expect(stepped(zoom, 50, -1)).toBe(50);
    expect(stepped(zoom, 60, -5)).toBe(50);
  });
});

describe('checkSetting', () => {
  it('refuses an unknown key, a key that isn’t text, and a bad value', () => {
    expect(() => checkSetting('appearance.nope', 'x')).toThrow(/no setting "appearance\.nope"/);
    expect(() => checkSetting(42, 'x')).toThrow(TypeError);
    expect(() => checkSetting({ key: 'appearance.face' }, 'x')).toThrow(/no setting/);
    expect(() => checkSetting('__proto__', {})).toThrow(/no setting/);
    expect(() => checkSetting('appearance.face', 'comic-sans')).toThrow(
      /^appearance\.face must be one of/,
    );
  });

  it('passes a good change through', () => {
    expect(checkSetting('appearance.face', 'literata')).toEqual({
      key: 'appearance.face',
      value: 'literata',
    });
    expect(checkSetting('page.zoom', 120)).toEqual({ key: 'page.zoom', value: 120 });
  });
});

describe('readSettings', () => {
  it('reads nothing, quietly, from no file', () => {
    expect(readSettings(undefined, 'device')).toEqual({ values: {}, problems: [] });
  });

  it('reports a file that isn’t an object', () => {
    for (const raw of [null, [], 'curly', 3]) {
      expect(readSettings(raw, 'vault')).toEqual({
        values: {},
        problems: [expect.stringMatching(/JSON object/)],
      });
    }
  });

  it('keeps the valid settings of its scope, and reports the rest', () => {
    const { values, problems } = readSettings(
      {
        'appearance.face': 'literata',
        'appearance.density': 'roomy',
        'books.numerals': 'arabic',
        'page.zoom': 115,
        'future.setting': true,
      },
      'device',
    );
    expect(values).toEqual({ 'appearance.face': 'literata' });
    expect(problems).toEqual([
      expect.stringMatching(/^appearance\.density must be one of .*; using "comfortable"/),
      expect.stringMatching(/^books\.numerals belongs to the vault/),
      expect.stringMatching(/^page\.zoom must be 50 to 200/),
      expect.stringMatching(/^Unknown setting "future\.setting"/),
    ]);
  });

  it('reads a vault file for vault settings only', () => {
    const { values, problems } = readSettings(
      { 'books.numerals': 'arabic', 'appearance.face': 'hanken' },
      'vault',
    );
    expect(values).toEqual({ 'books.numerals': 'arabic' });
    expect(problems).toEqual([expect.stringMatching(/^appearance\.face belongs to each device/)]);
  });

  it('treats a "__proto__" key as an unknown name, not the object’s prototype', () => {
    const raw: unknown = JSON.parse('{"__proto__": {"appearance.face": "literata"}}');
    const { values, problems } = readSettings(raw, 'device');
    expect(values).toEqual({});
    expect(withDefaults(values)['appearance.face']).toBe('newsreader');
    expect(problems).toEqual([expect.stringMatching(/Unknown setting "__proto__"/)]);
  });
});

describe('withDefaults', () => {
  it('fills every setting, chosen values first', () => {
    const values = withDefaults({ 'appearance.face': 'hanken' }, { 'books.numerals': 'arabic' });
    expect(values).toEqual({
      ...DEFAULT_SETTINGS,
      'appearance.face': 'hanken',
      'books.numerals': 'arabic',
    });
    expect(withDefaults({ 'page.zoom': 120 }, { 'page.zoom': 80 })['page.zoom']).toBe(120);
    expect(Object.keys(withDefaults())).toEqual(SETTINGS.map((setting) => setting.key));
  });
});

describe('withSetting', () => {
  it('sets one key and keeps the others, even ones it doesn’t know', () => {
    const raw = { 'books.numerals': 'arabic', 'ao3.future': { nested: true } };
    const next = withSetting(raw, { key: 'appearance.face', value: 'literata' });
    expect(next).toEqual({
      'books.numerals': 'arabic',
      'ao3.future': { nested: true },
      'appearance.face': 'literata',
    });
    expect(raw).toEqual({ 'books.numerals': 'arabic', 'ao3.future': { nested: true } }); // not changed in place
  });

  it('leaves a default out of the file', () => {
    expect(
      withSetting({ 'books.numerals': 'arabic', x: 1 }, { key: 'books.numerals', value: 'roman' }),
    ).toEqual({ x: 1 });
    expect(withSetting({}, { key: 'page.zoom', value: 100 })).toEqual({});
  });

  it('starts afresh from a file that isn’t an object', () => {
    for (const raw of [undefined, null, [1], 'text']) {
      expect(withSetting(raw, { key: 'page.zoom', value: 120 })).toEqual({ 'page.zoom': 120 });
    }
  });

  it('keeps a "__proto__" key as a plain key, and pollutes nothing', () => {
    const raw: unknown = JSON.parse('{"__proto__": {"polluted": true}}');
    const next = withSetting(raw, { key: 'page.zoom', value: 120 });
    expect(Object.getPrototypeOf(next)).toBe(Object.prototype);
    expect(Object.hasOwn(next, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(JSON.parse(JSON.stringify(next))).toEqual(
      JSON.parse('{"__proto__": {"polluted": true}, "page.zoom": 120}'),
    );
  });
});
