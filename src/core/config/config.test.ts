import { describe, expect, it } from 'vitest';
import {
  checkSetting,
  DEFAULT_SETTINGS,
  offeredOn,
  readSettings,
  SETTING_GROUPS,
  SETTINGS,
  settingOf,
  stepped,
  TOGGLES,
  valueProblem,
  withDefaults,
  withSetting,
} from './index';

describe('the schema', () => {
  it('names each setting once, as "section.name", in a known section', () => {
    const keys = SETTINGS.map((setting) => setting.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const setting of SETTINGS) {
      expect(setting.key).toMatch(/^[a-z][a-z0-9]*\.[a-zA-Z]+$/);
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

  it('turns on and off from the menu only settings whose choices are "off" and "on"', () => {
    for (const key of TOGGLES) {
      const setting = settingOf(key);
      expect(setting?.type === 'choice' && Object.keys(setting.choices)).toEqual(['off', 'on']);
      expect(setting?.scope).toBe('device');
    }
  });

  it('offers spellcheck on macOS alone, Wide screen and Two pages when narrow on the phone alone, and everything else everywhere', () => {
    const spellcheck = settingOf('editor.spellcheck');
    const phoneOnly = ['appearance.room', 'appearance.narrowPages'].map((key) => settingOf(key));
    if (!spellcheck || phoneOnly.some((setting) => !setting)) throw new Error('missing a setting');
    expect(offeredOn(spellcheck, 'darwin')).toBe(true);
    expect(offeredOn(spellcheck, 'win32')).toBe(false);
    expect(offeredOn(spellcheck, 'linux')).toBe(false);
    // The phone's build: Capacitor's android and ios, and web, its page in a browser (tests/mobile).
    for (const setting of phoneOnly)
      for (const phone of ['android', 'ios', 'web'])
        expect(setting && offeredOn(setting, phone)).toBe(true);
    // Interface zoom everywhere: the desktop's window by Electron, a phone's page by its viewport.
    const zoom = settingOf('window.zoom');
    for (const each of ['android', 'ios', 'web', 'darwin', 'win32', 'linux'])
      expect(zoom && offeredOn(zoom, each), each).toBe(true);
    for (const setting of phoneOnly)
      for (const desktop of ['darwin', 'win32', 'linux'])
        expect(setting && offeredOn(setting, desktop)).toBe(false);
    for (const setting of SETTINGS) {
      if (setting !== spellcheck && !phoneOnly.includes(setting))
        expect(offeredOn(setting, 'linux')).toBe(true);
    }
  });

  it('keeps today’s panes on a wide screen unless the writer chooses otherwise', () => {
    const room = settingOf('appearance.room');
    expect(room?.type === 'choice' && Object.keys(room.choices)).toEqual([
      'panes',
      'one',
      'side',
      'pages',
    ]);
    expect(room?.default).toBe('panes');
    expect(room?.scope).toBe('device'); // a tablet and a phone that share a vault each choose their own
    // It's the whole window's: offered on a phone too, so a foldable can choose before it opens.
    expect(room && 'wide' in room).toBe(false);
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

describe('the quick look’s mark (#49)', () => {
  it('marks Day or night for every page, and five of the page’s own, in the decided order', () => {
    const marked = SETTINGS.filter((setting) => 'quick' in setting).map((setting) => [
      setting.key,
      'quick' in setting && setting.quick,
    ]);
    expect(marked).toEqual([
      ['appearance.scheme', 'window'],
      ['appearance.face', 'page'],
      ['appearance.textSize', 'page'],
      ['appearance.leading', 'page'],
      ['page.width', 'page'],
      ['appearance.frame', 'page'],
    ]);
  });

  it('keeps each marked setting on this device, as a look is', () => {
    for (const setting of SETTINGS)
      if ('quick' in setting) expect(setting.scope, setting.key).toBe('device');
  });

  it('adds line spacing and page width, a step either side of the face’s own, As set by default', () => {
    const leading = settingOf('appearance.leading');
    const width = settingOf('page.width');
    expect(leading?.type === 'choice' && Object.keys(leading.choices)).toEqual([
      'tight',
      'set',
      'loose',
    ]);
    expect(width?.type === 'choice' && Object.keys(width.choices)).toEqual([
      'narrow',
      'set',
      'wide',
    ]);
    expect([DEFAULT_SETTINGS['appearance.leading'], DEFAULT_SETTINGS['page.width']]).toEqual([
      'set',
      'set',
    ]);
    expect([leading?.group, width?.group]).toEqual(['Type', 'Page']);
    expect(valueProblem(width as never, 'huge')).not.toBeNull();
  });

  it('offers page width only where a page has room round it: never in a phone’s one pane', () => {
    const width = settingOf('page.width');
    if (!width) throw new Error('missing page.width');
    expect(offeredOn(width, 'android', true)).toBe(false);
    expect(offeredOn(width, 'android', false)).toBe(true);
    expect(offeredOn(width, 'darwin')).toBe(true);
  });
});

describe('valueProblem', () => {
  const palette = settingOf('appearance.palette');
  const zoom = settingOf('page.zoom');
  if (!palette || !zoom) throw new Error('missing settings');

  it('accepts a listed choice and nothing else', () => {
    const face = settingOf('appearance.face');
    if (!face) throw new Error('missing settings');
    expect(valueProblem(face, 'literata')).toBeNull();
    for (const bad of [
      'Literata',
      '',
      'toString',
      '__proto__',
      'constructor',
      1,
      null,
      undefined,
      ['literata'],
    ]) {
      expect(valueProblem(face, bad)).toMatch(
        /^must be one of newsreader, literata, .*instrument$/,
      );
    }
  });

  it('takes the gallery’s themes, and a theme of the writer’s own by a name its file can have', () => {
    for (const good of ['paper', 'linen', 'blossom', 'slate', 'mine:Late Train']) {
      expect(valueProblem(palette, good), good).toBeNull();
    }
    for (const bad of [
      'Slate',
      '',
      'toString',
      '__proto__',
      'mine:',
      'mine:a/b',
      'mine:.x',
      1,
      null,
      ['slate'],
    ]) {
      expect(valueProblem(palette, bad)).toBe(
        'must be one of paper, linen, indigo, moss, candlelight, ink, blossom, slate, or a theme of your own (mine:<name>)',
      );
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
    const raw = { 'books.numerals': 'arabic', 'later.future': { nested: true } };
    const next = withSetting(raw, { key: 'appearance.face', value: 'literata' });
    expect(next).toEqual({
      'books.numerals': 'arabic',
      'later.future': { nested: true },
      'appearance.face': 'literata',
    });
    expect(raw).toEqual({ 'books.numerals': 'arabic', 'later.future': { nested: true } }); // not changed in place
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
